// @ts-nocheck
import { join } from "path";
import { readFileSync } from "fs";
import express from "express";
import serveStatic from "serve-static";
import "dotenv/config.js";

import shopify from "./shopify.js";
import crypto from "crypto";
import SevDeskAPI from "./sevdeskApi.js";
import SevDesk from "./sevdesk.js";
import Database from "./database.js";
import productCreator from "./product-creator.js";
import GDPRWebhookHandlers from "./gdpr.js";
import { generatePDF, generateHTML } from "./pdfGenerator.js";

const PORT = parseInt(process.env.BACKEND_PORT || process.env.PORT, 10);

const STATIC_PATH =
  process.env.NODE_ENV === "production"
    ? `${process.cwd()}/frontend/dist`
    : `${process.cwd()}/frontend/`;

const app = express();

app.use(express.json());

async function fetchOrders(url, shop_domain, allOrders = []) {
  const sevDeskApi = new SevDeskAPI(process.env.SEVDESK_API_KEY);
  console.log("Fetching orders", url);

  let apitoken = process.env.PRIVATE_STOREFRONT_API_TOKEN;

  //if shopdomain to lower includes b2b
  if (shop_domain.toLowerCase().includes("b2b")) {
    apitoken = process.env.PRIVATE_STOREFRONT_API_TOKEN_B2B;
  }

  try {
    const response = await fetch(url, {
      headers: {
        "Content-Type": "application/json",
        "X-Shopify-Access-Token": "" + apitoken,
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    const newOrders = data.orders;

    console.log("Fetched", allOrders.length);

    let orderWithOutInvoice = [];

    // for (const order of newOrders) {
    //   const invoiceArray = await sevDeskApi.getInvoiceByOrderId(order.id);
    //   if (invoiceArray.length === 0) {
    //     orderWithOutInvoice.push(order);
    //     continue;
    //   }

    //   invoices.push({ order, invoices: invoiceArray });
    // }

    allOrders = allOrders.concat(newOrders);

    const links = parseLinkHeader(response.headers.get("Link"));

    if (links && links.next) {
      return new Promise((resolve) => {
        setTimeout(() => {
          fetchOrders(links.next, shop_domain, allOrders).then(resolve); // Include allOrders here
        }, 500);
      });
    } else {
      console.log("Fetched all orders");
      return allOrders; // Return all orders along with their invoices
    }
  } catch (error) {
    console.error("Failed to fetch orders", error);
  }
}

async function processAndWriteOrders(orders, shop_domain) {
  const dataBase = new Database(process.env.DATABASE_URL);
  console.log("Processing orders", orders.length);

  for (const { order, invoices } of orders) {
    if (!order) {
      continue;
    }
    let duplicate = false;
    // console.log('Processing order', order);
    if (!invoices || invoices.length === 0) {
      console.log("No invoice found for order", order.id);
    } else if (invoices.length > 1) {
      duplicate = true;
      console.log("Multiple invoices found for order", order.id);
    }

    let invoiceObj = {
      id: order.id,
      created_at: order.created_at,
      shop_domain: shop_domain,
      fulfilled: order.fulfilled,
      reference_number: order.order_number,
      duplicate: duplicate,
      invoice_number: null,
      invoices: null,
    };

    if (invoices && invoices.length > 0) {
      (invoiceObj.invoice_number = invoices.map(
        (invoice) => invoice.invoiceNumber
      )),
        (invoiceObj.invoices = invoices.map((invoice) => invoice.id));
    }
    // Assuming properties like paid, refunded, shop_domain, fulfilled are part of the order object
    let ret = await dataBase.insertData("sync", invoiceObj);
  }
}

app.all("/api/webhooks/orders_create", async (req, res) => {
  try {

    //stop savdesk create invoice multiple times
    return res.json({ ok: true });
    
    const dataBase = new Database(process.env.DATABASE_URL);
    const shop_domain =
      req.headers["x-shopify-shop-domain"] || "";

    const order = req.body;
    if (order.id) {
      console.log(order.id);
    }

    const shopCustomer = order.customer;
    let customerId = "CPDCustomer";

    if (shopCustomer) {
      customerId = shopCustomer.id;
      console.log(customerId, "customerId");

    }
    // console.log(process.env.SEVDESK_API_KEY,'SEVDESK_API_KEY***************')
    // const sevDeskApi = new SevDeskAPI(process.env.SEVDESK_API_KEY);
    //2272a5c948de71489d24e1b5248e3a64
    const sevDeskApi = new SevDeskAPI("98dd6fbb5d627ee5a8bc9ee7975dc428");

    let orderId = parseInt(order.id);
    console.log(orderId, "orderId*****************");

    const customerFetch = await sevDeskApi.getContactById(customerId);
    // console.log(customerFetch, "fetch customer");

    // return res.json({ok:true})
    const [existingCustomer] = customerFetch;

    let customer = null;

    const sevDesk = new SevDesk(sevDeskApi);

    if (customerFetch?.length > 0) {
      try {
        customer = await sevDesk.updateCustomer(
          existingCustomer,
          order,
          shop_domain
        );
        customer.tags = shopCustomer.tags
      } catch (error) {
        console.error(error);
        res.status(200).send("Error updating customer");
        return;
      }

      if (customer === null) {
        res.status(200).send("Error updating customer");
        return;
      }
    }

    if (shopCustomer) {
      try {
        customer = await sevDesk.createCustomer(order, shop_domain);
        customer.tags = shopCustomer.tags
        // console.log(customer, "customer******************");
      } catch (error) {
        console.error(error);
        res.status(200).send("Error creating customer");
        return;
      }
    } else {
      customer = sevDesk.checkIfDefaultContactExists();
    }

    if (customer === null) {
      res.status(200).send("Error creating customer");
      return;
    }

    // console.log("customer", customer);

    // const invoice = await sevDesk.createInvoice(order, customer, shop_domain);
    // console.log(invoice, "invoice****************");
    return res.json({ ok: true });
  } catch (error) {
    console.log(error, "error while order create webhook");
    return res.json({ ok: false });
  }
});

app.post("/api/checkinvoices", async (req, res) => {
  //read everything from table sync
  const dataBase = new Database(process.env.DATABASE_URL);
  const sevDeskApi = new SevDeskAPI("cbc697f757226eeadd1a88899fa083bc");
  const shop_domain = req.headers["x-shopify-shop-domain"];

  let syncTable = await dataBase.query("SELECT * from sync");

  //go through every invoice_number and check for gaps in the numbers. this is the format RE-1000
  //console log the gaps

  let allInvoiceNumbers = syncTable
    .flatMap((row) => {
      if (row.invoice_number !== null) {
        // Remove the curly braces and wrap in square brackets
        let invoiceNumbersString =
          "[" + row.invoice_number.replace("{", "").replace("}", "") + "]";
        let invoiceNumbers = JSON.parse(invoiceNumbersString);
        return invoiceNumbers.map((num) => {
          let invoiceNum = num.trim().slice(3); // remove "RE-" prefix
          let parsedNum = Number(invoiceNum);
          if (isNaN(parsedNum)) {
            console.error("Failed to parse:", invoiceNum);
            return null;
          }
          return parsedNum;
        });
      }
      return [];
    })
    .filter((num) => num !== null); // Remove nulls

  // Sort the numbers
  allInvoiceNumbers.sort((a, b) => a - b);

  // 2. Check for gaps
  let gaps = [];
  for (let i = 1; i < allInvoiceNumbers.length; i++) {
    if (allInvoiceNumbers[i] - allInvoiceNumbers[i - 1] !== 1) {
      // Gap found
      gaps.push({
        start: allInvoiceNumbers[i - 1],
        end: allInvoiceNumbers[i],
      });
    }
  }

  // 3. Print missing numbers
  let invoiceNumbers = [];
  gaps.forEach((gap) => {
    for (let i = gap.start + 1; i < gap.end; i++) {
      // console.log('Missing invoice number: RE-', i);
      // console.log(i);
      invoiceNumbers.push(i);
    }
  });

  //look for invoices on sevdesk with the missing numbers

  let foundInvoices = [];
  for (const invoiceNumber of invoiceNumbers) {
    let formatedInvoiceNumber = "RE-" + invoiceNumber;
    let invoice = await sevDeskApi.getInvoiceById(formatedInvoiceNumber);

    if (invoice.length > 0) {
      foundInvoices.push(invoiceNumber);
      console.log("found invoice: " + formatedInvoiceNumber);
    }
  }

  console.log("done");
  console.log(invoiceNumbers.length);
  console.log(foundInvoices.length);
  //remove every element from invoiceNumbers that is in foundInvoices
  let missingInvoices = invoiceNumbers.filter(
    (x) => !foundInvoices.includes(x)
  );

  //console log missing invoices for each
  missingInvoices.forEach((invoiceNumber) => {
    console.log(invoiceNumber);
  });

  res.status(200).send("success");
});

app.post("/api/sync", async (req, res) => {
  let shop_domain = req.headers["x-shopify-shop-domain"];
  const date2 = new Date("4.10.2023 0:00:00");

  if (shop_domain.toLowerCase().includes("b2b")) {
    shop_domain = "b2b-isolarpro.myshopify.com";
  }

  const dataBase = new Database(process.env.DATABASE_URL);

  const url = `https://${shop_domain}/admin/api/2023-07/orders.json?status=any&created_at_min=2023-04-16T00:00:00Z`;

  const sevDeskApi = new SevDeskAPI("cbc697f757226eeadd1a88899fa083bc");

  const allOrders = await fetchOrders(url, shop_domain);

  for (let order of allOrders) {
    let invoiceFound = false;
    let invoiceNumbers = [];
    let duplicate = false;

    let invoiceFetch = await sevDeskApi.getInvoiceByOrderId(order.id);
    if (invoiceFetch.length > 0) {
      invoiceFound = true;
      invoiceNumbers = invoiceFetch.map((invoice) => invoice.invoiceNumber);

      if (invoiceNumbers.length > 1) {
        duplicate = true;
      }
    }

    let orderObj = {
      id: order.id,
      created_at: order.created_at,
      shop_domain: shop_domain,
      invoice_found: invoiceFound,
      invoice_numbers: invoiceNumbers,
      duplicate: duplicate,
      order_number: order.order_number,
      email: order.email,
    };

    let ret = await dataBase.insertData("sync", orderObj);
  }

  // fetchOrders(url, shop_domain)
  // .then(processAndWriteOrders)
  // .catch(console.error);

  res.status(200).send("success");
});

// Set up Shopify authentication and webhook handling
app.get(shopify.config.auth.path, shopify.auth.begin());
app.get(
  shopify.config.auth.callbackPath,
  shopify.auth.callback(),
  shopify.redirectToShopifyOrAppRoot()
);

// app.post(
//   shopify.config.webhooks.path,
//   shopify.processWebhooks({ webhookHandlers: GDPRWebhookHandlers })
// );

app.use(express.json({ limit: "50mb" }));

app.post("/api/perform_action", async (req, res) => {
  console.log("perform action");

  const response = {
    type: "simple_action_list",
    points_label: "ay",
    balance: "0",
    actions: [
      {
        type: "flat_discount",
        title: " Artikel - €",
        action_id: "MWSTBEF",
        description: "0 Mehrwertsteuer",
        value: "5",
      },
    ],
  };

  res.status(200).send(response);
});

app.post("/api/revert_action", async (req, res) => {
  console.log("revert action");
  // if(req.body.customer_id == null){
  //   res.status(200).send("success");
  //   return;
  // }
  let usersCheckouts = await getCheckouts(req);

  if (usersCheckouts.length == 0) {
    const response = {
      type: "simple_action_list",
      points_label: "",
      balance: "",
      actions: [],
    };
    res.status(200).send(response);
  } else {
    const response = {
      type: "simple_action_list",
      points_label: "Point balance",
      balance: "22867",
      actions: [],
    };
    res.status(200).send(response);
    return;
  }
});

app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.header('Access-Control-Allow-Credentials', 'true');
  
  if (req.method === 'OPTIONS') {
    return res.sendStatus(204);
  }

  next();
});


app.get("/api/getinvoiceid", async (req, res) => {
  try {
    const sevDeskApi = new SevDeskAPI(process.env.SEVDESK_API_KEY);

    //

    //find invoiceId by orderId
    const orderId = req.query.id;

    const [invoice] = await sevDeskApi.getInvoiceByOrderId(orderId);
    if (invoice) {
      const url = `https://my.sevdesk.de/#/fi/detail/type/RE/id/${invoice.id}`;

      res.json({ url }).status(200);
    } else {
      res.json({ url: "https://my.sevdesk.de" }).status(200);
    }

    // Redirect the user to SevDesk with the order ID
  } catch (e) {
    console.log(e);
    res.json({ url: "https://my.sevdesk.de/" });
  }
});

// app.get("/api/recalc", async (req, res) => {
//   try {

//     const sevDeskApi = new SevDeskAPI("2af421a3fae4c440f9384570c32f86c2");

//     const order = await getOrder(req);
//     //find invoiceId by orderId
//     const orderId = req.query.id;

//     let totalPrice = 0.0;
//     let totalDiscount = 0.0;

//     order.line_items.forEach((item) => {
//         const { quantity, price } = item;
//         totalPrice += quantity * price;

//         item.discount_allocations.forEach(discount => {
//             totalDiscount += parseFloat(discount.amount);
//         });
//     });

//     const totalPriceWithTax = totalPrice / (1 + 19 / 100);
//     const totalTax = totalPrice - totalPriceWithTax;

//     let hasMwStBefreiung = false;

//     if(order.discount_applications){

//         order.discount_applications.forEach(app => {
//             if (app.title && app.title.toLowerCase().includes("mwst")) {
//                 hasMwStBefreiung = true;
//             }
//         });
//     }

//     if(order.discounts){
//         order.discounts.forEach(discount => {
//             if (discount.code && discount.code.toLowerCase().includes("mwst")) {
//                 hasMwStBefreiung = true;
//             }
//         });
//     }

//     if(!hasMwStBefreiung){
//         hasMwStBefreiung = Math.abs(totalDiscount - totalTax) < 0.01;
//     }

//     console.log("brutto: " + totalPrice);
//     console.log("totalDiscount: " + totalDiscount);
//     console.log("netto: " + totalPriceWithTax);
//     console.log("totalTax: " + totalTax);

//     const taxText = hasMwStBefreiung ? "Steuerfrei 0% lt. § 12 Absatz 3 UStG" : "zzgl. Umsatzsteuer 19%";
//     //const taxId = hasMwStBefreiung ? "83858" : "83859";
//       const taxId = hasMwStBefreiung ? "84290" : "84291";

//     const taxRate = hasMwStBefreiung ? "0" : "19";

//     const sevUser = await sevDeskApi.getSevUser();
//     const sevUserId = sevUser[0].id;

//     const invoiceData = {
//       invoice: {
//           header: `Rechnung Nr. `,
//           invoiceDate: order.created_at,
//           contact: { id: 61080720, objectName: "Contact" },
//           status: 1000,
//           address: "as",
//           addressCountry: { id: 1, objectName: "StaticCountry" },
//           contactPerson: { id: sevUserId, objectName: "SevUser" },
//           paymentMethod: { id: "21919", objectName: "PaymentMethod" },
//           taxRate,
//           taxText,
//           taxType: "custom",
//           taxSet: { id: taxId, objectName: "TaxSet" },
//           invoiceType: "RE",
//           currency: "EUR",
//           mapAll: "true",
//           id: null,
//           invoiceNumber: "Re-9129",
//           objectName: "Invoice",
//           customerInternalNote: "asd",
//       },
//       invoicePosSave: []
//   };

//     let discountedTotalPrice = 0;
//     let roundedTotalPrice = 0;

//     order.line_items.forEach((item) => {
//         const { quantity, price, title, total_discount } = item;

//         let proportionalDiscount = (quantity * price / totalPrice) * totalDiscount;

//         const discountedPrice = parseFloat(price - proportionalDiscount / quantity);
//         const roundedDiscountedPrice = Math.round(discountedPrice * 100) / 100;

//         discountedTotalPrice += discountedPrice * quantity;
//         roundedTotalPrice += roundedDiscountedPrice * quantity;

//         // Calculate the exact difference between the discountedTotalPrice and roundedTotalPrice
//         const priceDifference = discountedTotalPrice - roundedTotalPrice;

//         if (Math.abs(priceDifference) > 0.01) {
//             roundedTotalPrice += priceDifference;
//         }

//         let priceTax = roundedDiscountedPrice - (roundedDiscountedPrice / (1 + taxRate / 100));

//         const invoicePos = {
//             objectName: "InvoicePos",
//             mapAll: true,
//             quantity,
//             price: roundedDiscountedPrice / (1 + taxRate / 100),
//             priceGross: roundedDiscountedPrice,
//             taxRate,
//             name: title,
//             priceTax,
//             unity: { id: 1, objectName: "Unity" },
//         };

//         invoiceData.invoicePosSave.push(invoicePos);
//     });

//     // Adjust the rounding difference for the last invoice position
//     const roundingDifference = discountedTotalPrice - roundedTotalPrice;
//     const lastInvoicePos = invoiceData.invoicePosSave[invoiceData.invoicePosSave.length - 1];
//     lastInvoicePos.price += roundingDifference / lastInvoicePos.quantity;

//     console.log(discountedTotalPrice, "discountedTotalPrice");
//     console.log(roundedTotalPrice, "roundedTotalPrice ");
//     console.log(roundedTotalPrice + roundingDifference, "roundedTotalPrice (adjusted)");

//     let totalNetPrice = 0;
//     let totalGross = 0;

//     invoiceData.invoicePosSave.forEach((invoicePos) => {
//       const { price, priceGross, quantity } = invoicePos;
//       let totalPriceForItem = price * quantity;
//       totalPriceForItem = priceGross * quantity;

//       totalNetPrice += totalPriceForItem;
//       totalGross += totalPriceForItem;
//     });

//     console.log(totalNetPrice, "totalNetPrice");
//     console.log(totalGross, "totalGross");

//     const ret = await sevDeskApi.createInvoice(invoiceData);

//     res.status(200).json(invoiceData);

//     // Redirect the user to SevDesk with the order ID

//   } catch (e) {
//     console.log(e);
//     res.json({ url: "https://my.sevdesk.de/#/fi/detail/type/RE/id/5823" });
//   }

// });

app.get("/api/getLieferscheinPDF", async (req, res) => {
  try {
    const order = await getOrder(req);

    let htmlContent = await generateHTML(order);

    res.status(200).json(htmlContent);
  } catch (e) {
    console.log("ERROR:", e);
    res.status(200).send("Error");
  }
});

app.post("/api/promotions", async (req, res) => {
  console.log("promotions", req.body);

  //1,5 sec timeout

  if (req.body.customer_id == null) {
    res.status(200).send("success");
    return;
  }
  const usersCheckouts = await getCheckouts(req);

  if (usersCheckouts.length == 1) {
    var ch = usersCheckouts[0];

    const totalPrice = ch.total_price;

    const netPrice =
      Math.round((totalPrice / 1.19 + Number.EPSILON) * 100) / 100;
    const totalTax =
      Math.round((totalPrice - netPrice + Number.EPSILON) * 100) / 100;

    let quantity = 0;
    ch.line_items.forEach((item) => {
      quantity += item.quantity;
    });

    //round number to 2 decimal places
    const newprice =
      Math.round((totalPrice - totalTax + Number.EPSILON) * 100) / 100;
    const response = {
      type: "simple_action_list",
      points_label: newprice + "€",
      points_balance: quantity + " Artikel",
      actions: [
        {
          type: "flat_discount",
          title: "MwSt. Befreiung",
          action_id: "MWSTBEF",
          description: "0% Mehrwertsteuer.",
          value: "" + totalTax,
        },
      ],
    };
    res.status(200).send(response);
  } else {
    const response = {
      type: "simple_action_list",
      points_label: "",
      balance: "",
      actions: [],
    };
    res.status(200).send(response);
    return;
  }
});

//link payouts

const getBillingAddress = (shopCustomer) => {
  if (!shopCustomer) return null;

  if (shopCustomer.billing_address) return shopCustomer.billing_address;

  if (shopCustomer.default_address) return shopCustomer.default_address;
};

app.post("/api/save_settings", async (req, res) => {
  try {
    const { apiKey, headerText, footerText } = req.body;

    // Validate input data
    if (!apiKey || !headerText || !footerText) {
      res.status(400).json({ message: "All fields are required" });
      return;
    }

    console.log("Saving settings:", req.body);
    // Save the data to the database
    // Replace with your own database logic
    const settings = {
      apiKey,
      headerText,
      footerText,
    };

    // For example, if you use a MongoDB database with Mongoose
    // const settingsModel = new SettingsModel(settings);
    // await settingsModel.save();

    // Send a success response
    res.status(200).json({ message: "Settings saved successfully" });
  } catch (error) {
    console.error("Error saving settings:", error);
    res.status(500).json({ message: "Error saving settings" });
  }
});

// app.post("/api/orderchangedb2b", async (req, res) => {

//   const order = req.body;

//   let invoicePosSave = [];
//   //for each order.item
//   const sevDeskApi = new SevDeskAPI("cbc697f757226eeadd1a88899fa083bc");
// const sevDesk = new SevDesk(sevDeskApi);
//   let customer = null;
//   const shop_domain = req.headers["x-shopify-shop-domain"];
//   let customerId = order.customer.id;
//   const customerFetch = await sevDeskApi.getContactById(customerId);
//   const [existingCustomer] = customerFetch;

//   //If Customer exists on SevDesk
//   if (customerFetch.length > 0) {

//     try {
//       customer = await sevDesk.updateCustomer(existingCustomer, order, shop_domain);
//       customer.tags = order?.customer?.tags
//     }
//     catch (error) {
//       console.error(error);
//       res.status(500).send("Error updating customer");
//       return;
//     }

//     if (customer === null) {
//       res.status(500).send("Error updating customer");
//       return;
//     }

//     // invoiceObj.contact_id = customer.id;

//   }

// invoice = await sevDesk.createInvoice(order, customer, shop_domain);

//   console.log(invoicePosSave);
//   res.status(200).send("success");
// });

//new endpoint for order changed webhook
app.post("/api/testtest", async (req, res) => {
  let order = req.body;
  let marktplatz = "Shopify";

  if (order.note) {
    const note = order.note;
    const marktplatzIndex = note.indexOf("Marktplatz:");
    if (marktplatzIndex !== -1) {
      const endOfLineIndex = note.indexOf("\n", marktplatzIndex);
      const value = note.substring(
        marktplatzIndex + "Marktplatz:".length,
        endOfLineIndex
      );
      marktplatz = value.trim();
    }
  }
  console.log(marktplatz);

  res.status(200).send("success");
});

app.post("/api/testorder", async (req, res) => {
  console.log("testorder");
  const order = req.body;

  // let addressFields = getBillingAddress2(order);
  // let { company, address1, address2, zip, city, country } = addressFields;

  // if(order.note_attributes && order.note_attributes.length > 0){
  //   const pickupLocationCompanyAttr = order.note_attributes.find(attr => attr.name === "Pickup-Location-Company");
  //   const pickupLocationCompany = pickupLocationCompanyAttr?.value;
  //   const isSameCompany = pickupLocationCompany === company;

  //   if(isSameCompany){
  //       company = "";
  //   }
  // }

  // console.log("company", company);

  const shop_domain = req.headers["x-shopify-shop-domain"];
  const sevDeskApi = new SevDeskAPI("98dd6fbb5d627ee5a8bc9ee7975dc428");
  const shopCustomer = order.customer;
  let customerId = "CPDCustomer";
  if (shopCustomer) {
    customerId = shopCustomer.id;
  }
  const customerFetch = await sevDeskApi.getContactById(customerId);
  const [existingCustomer] = customerFetch;

  let customer = null;
  const sevDesk = new SevDesk(sevDeskApi);

  if (customerFetch.length > 0) {
    try {
      customer = await sevDesk.updateCustomer(
        existingCustomer,
        order,
        shop_domain
      );
      customer.tags = shopCustomer.tags
      console.log("customer updated", customer);
    } catch (error) {
      console.error(error);
      res.status(200).send("Error updating customer");
      return;
    }

    if (customer === null) {
      res.status(200).send("Error updating customer");
      return;
    }
  }

  res.status(200).send("ok");
});

app.post("/api/orderchanged", async (req, res) => {
  const dataBase = new Database(process.env.DATABASE_URL);

  const order = req.body;
  if (order.id) {
    console.log(order.id);
  }

  // if (order.discount_applications.length > 0) {
  //   order.discount_applications.forEach((item) => {

  //       //if item.title to lower doesnt contain "mwst" or "mehrwertsteuer"

  //       if (!item.title.toLowerCase().includes("mwst") && !item.title.toLowerCase().includes("mehrwertsteuer") && item.value_type == "fixed_amount") {

  //         if(item.target_selection == "explicit" && item.type == "manual") {
  //           return;
  //         }

  //         console.log("item", item);

  //       }
  //     });
  // }

  const shop_domain = req.headers["x-shopify-shop-domain"];
  console.log(shop_domain, "shop domain@@@@@@@@@@@@@@@@@@@@");
  //convert date to local time
  const date = new Date(order.created_at);
  const localDate = date.toLocaleString("de-DE", { timeZone: "Europe/Berlin" });

  //convert "12.4.2023 17:00:00" to local time
  const date2 = new Date("4.16.2023 0:00:00");
  const localDate2 = date2.toLocaleString("de-DE", {
    timeZone: "Europe/Berlin",
  });

  //if localdate was before 12.04.2023: 17:00:00

  let dateb2b = new Date("5.17.2023 9:30:00");
  let b2bDate = dateb2b.toLocaleString("de-DE", { timeZone: "Europe/Berlin" });
  //if shop_domain contains b2b and order is before 17.05.2023: 9:30:00
  //if order.tags includes rebuild
  //if order.tags includes rebuild

  if (
    shop_domain?.includes("b2b") &&
    date < dateb2b &&
    !order.tags.includes("rebuild")
  ) {
    console.log("B2b: Order created before", b2bDate);
    return res.status(200).send("success");
  }

  if (date < date2) {
    console.log("old order");
    return res.status(200).send("ok");
  }

  if (!order?.customer.tags) {
    order.customer.tags = "test";
  }

  // Compare the Date objects directly
  // if (date < date2 && !order.tags.includes("rebuild")) {
  //   console.log("Order created before", localDate2);

  //   //write into db table old_orders (id, updated_at[])
  //   const orderId = parseInt(order.id);
  //   const updatedAt = new Date().toLocaleString("de-DE", { timeZone: "Europe/Berlin" });

  //   const oldOrders = await dataBase.query("SELECT * FROM old_orders WHERE id = $1", [orderId]);

  //   if (oldOrders && oldOrders.length > 0) {
  //     const oldOrder = oldOrders[0];
  //     const oldUpdatedAt = oldOrder.updated_at;
  //     const newUpdatedAt = [...oldUpdatedAt, updatedAt];
  //     await dataBase.query("UPDATE old_orders SET updated_at = $1 WHERE id = $2", [newUpdatedAt, orderId]);
  //   } else {
  //     await dataBase.query("INSERT INTO old_orders (id, updated_at) VALUES ($1, $2)", [orderId, [updatedAt]]);
  //   }

  //   return res.status(200).send("ok");
  // }

  const shopCustomer = order.customer;
  console.log(shopCustomer, "shopCustomer");
  let customerId = "CPDCustomer";

  if (shopCustomer) {
    customerId = shopCustomer.id;
  }
  // console.log(process.env.SEVDESK_API_KEY,'SEVDESK_API_KEY***************')
  // const sevDeskApi = new SevDeskAPI(process.env.SEVDESK_API_KEY);
  //2272a5c948de71489d24e1b5248e3a64
  const sevDeskApi = new SevDeskAPI("98dd6fbb5d627ee5a8bc9ee7975dc428");

  let orderId = parseInt(order.id);
  const invoices = await dataBase.query("SELECT * FROM orders WHERE id = $1", [
    orderId,
  ]);
  let invoiceObj = null;
  let newInvoice = !invoices || invoices.length === 0;

  if (!newInvoice && invoices) {
    invoiceObj = invoices[0];
  }

  const discounts = order.discount_codes;

  if (newInvoice) {
    let paid = false;
    let fulfilled = false;
    let refunded = false;

    switch (order.fullfillment_status) {
      case "fulfilled":
        fulfilled = true;
        break;

      case "unfulfilled":
        fulfilled = false;
        break;
    }

    switch (order.financial_status) {
      case "paid":
        paid = true;
        break;
      case "refunded":
        refunded = true;
        break;
    }

    invoiceObj = await dataBase.insertData("orders", {
      id: orderId,
      created_at: new Date(),
      updated_at: new Date(),
      paid,
      refunded,
      shop_domain,
      fulfilled,
      reference_number: order.order_number,
      email_sent: false,
      booked: false,
    });
  } else {
  }

  const customerFetch = await sevDeskApi.getContactById(customerId);
  console.log(customerFetch, "fetch customer");

  // return res.json({ok:true})
  const [existingCustomer] = customerFetch;

  let customer = null;

  const sevDesk = new SevDesk(sevDeskApi);

  if (customerFetch?.length > 0) {
    try {
      customer = await sevDesk.updateCustomer(
        existingCustomer,
        order,
        shop_domain
      );
      customer.tags = shopCustomer.tags
    } catch (error) {
      console.error(error);
      res.status(200).send("Error updating customer");
      return;
    }

    if (customer === null) {
      res.status(200).send("Error updating customer");
      return;
    }
  }
  //If Customer does not exist on SevDesk
  else {
    if (shopCustomer) {
      try {
        customer = await sevDesk.createCustomer(order, shop_domain);
        customer.tags = shopCustomer.tags
        console.log(customer, "customer******************");
      } catch (error) {
        console.error(error);
        res.status(200).send("Error creating customer");
        return;
      }
    } else {
      customer = sevDesk.checkIfDefaultContactExists();
    }

    if (customer === null) {
      res.status(200).send("Error creating customer");
      return;
    }
    // invoiceObj.contact_id = customer.id;
  }
  console.log(customer, "customer");
  //Look for existing invoice
  let invoice = null;

  try {
    invoice = await sevDeskApi.getInvoiceByOrderId(order.id);
    const [existingInvoice] = invoice;

    // console.log("existingInvoice.status",invoice)

    //invoice exists
    if (existingInvoice) {
      // console.log("invoice exists", existingInvoice.id);

      let paid = false;
      let fulfilled = false;
      let refunded = false;
      let canceled = false;
      let partially_refunded = false;
      let voided = false;

      // console.log(order.fulfillment_status, "order.fullfillment_status");
      // console.log(order.financial_status, "order.financial_status");

      //if order.refunds is not empty, set  refunded = true

      if (order.cancelled_at !== null) {
        canceled = true;
        // console.log("order canceled", order.cancelled_at)
        const cancelInvoice = await sevDeskApi.cancelInvoice(
          existingInvoice.id,
          0,
          order
        );

        if (cancelInvoice) {
          console.log("invoice canceled", existingInvoice.id);
          res.status(200).send("ok");
          return;
        } else {
          console.log(cancelInvoice);
          //delete invoice
          const deleteInvoice = await sevDeskApi.deleteInvoice(
            existingInvoice.id
          );
          console.log("invoice deleted", existingInvoice.id);
          res.status(200).send("ok");
          return;
        }
      }

      switch (order.fulfillment_status) {
        case "fulfilled":
          fulfilled = true;
          break;

        case "unfulfilled":
          fulfilled = false;
          break;
      }

      switch (order.financial_status) {
        case "paid":
          paid = true;
          break;
        case "refunded":
          refunded = true;
          break;
        case "partially_refunded":
          partially_refunded = true;
          break;
        case "voided":
          voided = true;
          break;
      }
      const orderData = await dataBase.selectData("orders", { id: order.id });

      let emailSent = false;

      if (orderData.length > 0) {
        emailSent = orderData[0].email_sent;
      }
      var getEmail = await sevDeskApi.getEmail(existingInvoice.contact.id);
      console.log("getEmail", getEmail[0]);

      if (getEmail[0] && !emailSent) {
        const MailSent = await sevDeskApi.sendInvoiceViaMail(
          existingInvoice.id,
          getEmail[0].value,
          order.name
        );
        const updatedTest = await dataBase.updateData(
          "orders",
          {
            email_sent: true,
          },
          {
            id: order.id,
          }
        );
      }

      if (existingInvoice.contact.id != customer.id) {
        // console.log("customer changed");
      }

      if (paid) {
        await sevDeskApi.renderInvoice(existingInvoice.id);

        try {
          const orderData = await dataBase.selectData("orders", {
            id: order.id,
          });

          let emailSent = false;

          if (orderData.length > 0) {
            emailSent = orderData[0].email_sent;
          }
          var getEmail = await sevDeskApi.getEmail(existingInvoice.contact.id);
          console.log("getEmail", getEmail[0]);

          if (getEmail[0] && !emailSent) {
            const MailSent = await sevDeskApi.sendInvoiceViaMail(
              existingInvoice.id,
              getEmail[0].value,
              order.name
            );
            const updatedTest = await dataBase.updateData(
              "orders",
              {
                email_sent: true,
              },
              {
                id: order.id,
              }
            );
          }

          invoice = await sevDesk.bookInvoice(existingInvoice);

          if (invoice == null) {
            console.log("already booked");
            res.status(200).send("Invoice already booked");
            return;
          }
        } catch (error) {
          console.log("Error booking invoice", invoice);
          console.error(error, "error booking invoice");
          res.status(200).send("Error booking invoice");
          return;
        }

        // return res.status(200).send("ok");
      } else if (voided) {
        try {
          const invoiceExists = await sevDeskApi.getInvoiceById(
            existingInvoice.id
          );
          if (invoiceExists) {
            invoice = await sevDeskApi.deleteInvoice(existingInvoice.id);
            console.log("invoice deleted", existingInvoice.id);
            res.status(200).send("Invoice deleted");
            return;
          } else {
            console.log("invoice already deleted");
          }
        } catch (error) {
          console.error(error, "error deleting invoice");
          res.status(200).send("Error deleting invoice");
          return;
        }
      } else if (
        existingInvoice.status === "100" ||
        existingInvoice.status === "200"
      ) {
        try {
          invoice = await sevDesk.updateInvoice(
            order,
            customer,
            existingInvoice,
            shop_domain
          );

          if (invoice === null) {
            console.log(
              "Error updating invoice, Invoice maybe already enshrined"
            );
            res.status(200).send("Error updating invoice");
            return;
          }
          //5second timeout
          await new Promise((resolve) => setTimeout(resolve, 5000));
          await sevDeskApi.renderInvoice(invoice.id);

          if (invoice === null) {
            console.log(
              "Error updating invoice, Invoice maybe already enshrined"
            );
            res.status(200).send("Error updating invoice");
            return;
          }
        } catch (error) {
          console.error(error, "error updating invoice");
          res.status(200).send("Error updating invoice");
          return;
        }
      } else {
        invoice = existingInvoice;

        console.log("invoice.contact.id", invoice.contact.id);

        const orderData = await dataBase.selectData("orders", { id: order.id });

        let emailSent = false;

        if (orderData.length > 0) {
          emailSent = orderData[0].email_sent;
        }

        var getEmail = await sevDeskApi.getEmail(invoice.contact.id);
        console.log("getEmail", getEmail);

        if (getEmail[0] && !emailSent) {
          const MailSent = await sevDeskApi.sendInvoiceViaMail(
            invoice.id,
            getEmail[0].value,
            order.name
          );
          const updatedTest = await dataBase.updateData(
            "orders",
            {
              email_sent: true,
            },
            {
              id: order.id,
            }
          );
        }
      }
      const refunDate2 = new Date("7.28.2023 0:00:00");

      //sleep 5 seconds
      if (refunded && order.refunds.length === 1) {
        let refund = order.refunds[0];
        //convert "12.4.2023 17:00:00" to local time
        if (new Date(refund.created_at) > refunDate2) {
          //look for refund in db
          const ret = await dataBase.selectData("refunds", { id: refund.id });

          if (ret.length === 0) {
            const creditNote = await sevDesk.cancelInvoice(
              existingInvoice,
              0,
              order
            );
            await sevDeskApi.renderInvoice(existingInvoice.id);
            const refundObj = await dataBase.insertData("refunds", {
              id: order.refunds[0].id,
              amount: order.price,
              paid: true,
              order_id: order.id,
            });
          } else {
            if (ret[0].paid) {
              console.log("refund already paid");
            } else {
              const creditNote = await sevDesk.cancelInvoice(
                existingInvoice,
                ret[0].creditnote_id,
                order
              );
              await sevDeskApi.renderInvoice(existingInvoice.id);
              const refundObj = await dataBase.updateData("refunds", {
                id: order.refunds[0].id,
                amount: order.price,
                paid: true,
                creditnote_id: creditNote.id,
                order_id: order.id,
              });
            }
          }
        }
      } else if ((refunded && order.refunds.length > 1) || partially_refunded) {
        const processRefund = async (refund) => {
          //if refund has no transactions, skip
          if (new Date(refund.created_at) > refunDate2) {
            //look for refund in db
            const ret = await dataBase.selectData("refunds", { id: refund.id });

            // const ret = await dataBase.query("refunds", { id: refund.id });

            if (ret.length === 0) {
              // console.log("refund", refund);
              const ccn = await sevDesk.createCreditNote(
                refund,
                order,
                customer,
                existingInvoice
              );
              await sevDeskApi.renderInvoice(existingInvoice.id);

              // Save in db
              const refundObj = await dataBase.insertData("refunds", ccn);
            } else if (!ret[0].paid) {
              const creditNode = ret[0];
              const creditNodeId = creditNode.id;

              const ccn = await sevDesk.updateCreditNoteStatus(
                refund,
                creditNode
              );

              if (ccn) {
                const updatedTest = await dataBase.updateData(
                  "refunds",
                  { paid: true },
                  { id: creditNodeId }
                );
              }
            } else {
              console.log("refund already paid");
            }
          }
        };

        for (const refund of order.refunds) {
          if (refund.transactions.length === 0) {
            continue;
          }
          await processRefund(refund);
        }
      }

      if (canceled) {
        const creditNote = await sevDesk.cancelInvoice(
          existingInvoice,
          0,
          order
        );
      }

      res.status(200).send("ok");
      return;
    }

    //invoice does not exist
    else {
      console.log("invoice does not exist");

      if (order.cancelled_at) {
        console.log("order is canceled");
        res.status(200).send("order is canceled");
        return;
      }

      invoice = await sevDesk.createInvoice(order, customer, shop_domain);

      // console.log("invoice created", invoice);
      const invoiceRender = await sevDeskApi.renderInvoice(invoice.id);

      //check if order.email_sent is true in database

      const orderData = await dataBase.selectData("orders", { id: order.id });
      let emailSent = false;

      if (orderData.length > 0) {
        emailSent = orderData[0].email_sent;
      }

      var getEmail = await sevDeskApi.getEmail(invoice.contact.id);
      console.log("getEmail", getEmail[0]);

      if (getEmail[0] && !emailSent) {
        const MailSent = await sevDeskApi.sendInvoiceViaMail(
          invoice.id,
          getEmail[0].value,
          order.name
        );
        //set order.email_sent to true in database

        const updatedTest = await dataBase.updateData(
          "orders",
          {
            email_sent: true,
          },
          {
            id: order.id,
          }
        );
      }

      if (
        order.fulfillment_status === "fulfilled" ||
        order.financial_status === "paid" ||
        invoice.paidStatus === "200"
      ) {
        console.log("invoice.contact.id", invoice.contact.id);
      }
      if (order.financial_status === "paid") {
        invoice = await sevDesk.bookInvoice(invoice);
      }

      if (invoice == null) {
        res.status(200).send("Error creating invoice");
        return;
      } else {
      }

      //update order invoice_id in database

      //render invoice
    }

    // if(invoice.sendType == "VM"){
    //   console.log("invoice already sent");
    // }
    // else{
    //   console.log("invoice not sent yet");

    //   if(order.email){
    //     const mailSent = await sevDeskApi.sendInvoiceViaMail(invoice.id, order.email,invoice.invoiceNumber);
    //     console.log(mailSent, "mail sent");
    //     const updateMail = await sevDeskApi.setInvoiceAsSent(invoice.id);
    //   }
    //   else{
    //     console.log("customer has no email");
    //   }
    //   // console.log(updateMail);
    // }

    res.status(200).send("ok");
    return;
  } catch (error) {
    console.error(error);
    res.status(200).send("Error fetching invoice");
    return;
  }
});

app.get("/api/linkpayouts", async (_req, res) => {
  let payouts = [];
  const url = `https://isolarpro.myshopify.com/admin/api/2023-01/shopify_payments/payouts.json?status=paid`;
  await fetch(url, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      "X-Shopify-Access-Token": "" + process.env.PRIVATE_STOREFRONT_API_TOKEN,
    },
  })
    .then((response) => response.json())
    .then((data) => (payouts = data.payouts))
    .catch((error) => console.error(error));

  var orders = [];

  payouts.forEach(async (payout) => {
    var payoutId = payouts[0].id;

    const url2 = `https://isolarpro.myshopify.com/admin/api/2023-01/shopify_payments/balance/transactions.json?payout_id=${payoutId}`;

    var transactions = [];

    await fetch(url2, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        "X-Shopify-Access-Token": "" + process.env.PRIVATE_STOREFRONT_API_TOKEN,
      },
    })
      .then((response) => response.json())
      .then((data) => (transactions = data.transactions))
      .catch((error) => console.error(error));
  });

  res.status(200).send(transactions);
});
// All endpoints after this point will require an active session
app.use("/api/*", shopify.validateAuthenticatedSession());

// app.get("/api/payouts", async (_req, res) => {

//   const payouts = await shopify.api.rest.Payout.all({
//     session: res.locals.shopify.session
//   });

//   console.log(payouts, "payouts");
//   res.status(200).send(payouts);
// });

app.get("/api/products/count", async (_req, res) => {
  const countData = await shopify.api.rest.Product.count({
    session: res.locals.shopify.session,
  });
  res.status(200).send(countData);
});

app.get("/api/products/create", async (_req, res) => {
  let status = 200;
  let error = null;

  try {
    await productCreator(res.locals.shopify.session);
  } catch (e) {
    console.log(`Failed to process products/create: ${e.message}`);
    status = 500;
    error = e.message;
  }
  res.status(status).send({ success: status === 200, error });
});

app.use(serveStatic(STATIC_PATH, { index: false }));

app.use("/*", shopify.ensureInstalledOnShop(), async (_req, res, _next) => {
  console.log(shopify.config.sessionStorage, "shopify");
  return res
    .status(200)
    .set("Content-Type", "text/html")
    .send(readFileSync(join(STATIC_PATH, "index.html")));
});

app.listen(PORT);

function parseLinkHeader(header) {
  if (!header || header.length === 0) {
    return null;
  }

  let parts = header.split(", ");
  let links = {};
  parts.forEach((p) => {
    let section = p.split(";");
    if (section.length !== 2) {
      throw new Error("section could not be split on ';'");
    }
    let url = section[0].replace(/<(.*)>/, "$1").trim();
    let name = section[1].replace(/rel="(.*)"/, "$1").trim();
    links[name] = url;
  });

  return links;
}

async function getOrder(req) {
  ///admin/api/2023-04/orders/450789469.json?fields=id,line_items,name,total_price
  const orderId = req.query.id;
  const token = process.env.PRIVATE_STOREFRONT_API_TOKEN;
  const url = `https://isolarpro.myshopify.com/admin/api/2023-07/orders/${orderId}.json?fields=id,line_items,created_at,tags,note,note_attributes,name,total_price,shipping_address,billing_address,customer,discounts,discount_application`;

  let order = null;
  await fetch(url, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      "X-Shopify-Access-Token": "" + token,
    },
  })
    .then((response) => response.json())
    .then((data) => (order = data.order))
    .catch((error) => console.error(error));

  return order;
}

async function getCheckouts(req) {
  let timestamp =
    new Date(Date.now()).toISOString().substring(0, 19) + "-04:00";

  //timestamp now 30 minutes ago

  const timestampnow = new Date(Date.now() - 300000).toISOString();
  console.log(timestampnow, "timestampnow");

  await new Promise((resolve) => setTimeout(resolve, 150));

  const timestampBefore = new Date(Date.now() - 5 * 60 * 1000).toISOString();

  const token = process.env.PRIVATE_STOREFRONT_API_TOKEN;

  let checkouts = [];
  const url = `https://isolarpro.myshopify.com/admin/api/2023-07/checkouts.json?status=open&updated_at_min=${timestampnow}`;
  await fetch(url, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      "X-Shopify-Access-Token": "" + token,
    },
  })
    .then((response) => response.json())
    .then((data) => (checkouts = data.checkouts))
    .catch((error) => console.error(error));
  //find checkout in checkouts where customer.id = req.body.customer_id
  if (checkouts) {
    let usersCheckouts = [];
    console.log(checkouts.length, "checkouts.length");

    checkouts.forEach((element) => {
      if (
        element.customer &&
        element.line_items &&
        element.customer.id == req.body.customer_id
      ) {
        usersCheckouts.push(element);
      }
    });

    return usersCheckouts;
  } else {
    console.log("null");
    return [];
  }
}

function getBillingAddress2(order) {
  const shopCustomer = order.customer;
  var ret = {
    company: "",
    address1: "",
    address2: "",
    zip: "",
    city: "",
    country: "Germany",
  };

  if (!shopCustomer) {
    return ret;
  }

  if (shopCustomer.billing_address) {
    if (shopCustomer.billing_address.company) {
      ret.company = shopCustomer.billing_address.company;
    }
    ret.address1 = shopCustomer.billing_address.address1;
    if (shopCustomer.billing_address.address2) {
      ret.address2 = shopCustomer.billing_address.address2;
    }
    ret.zip = shopCustomer.billing_address.zip;
    ret.city = shopCustomer.billing_address.city;
    ret.country = shopCustomer.billing_address.country;
    return ret;
  }

  if (shopCustomer.default_address) {
    if (shopCustomer.default_address.company) {
      ret.company = shopCustomer.default_address.company;
    }
    ret.address1 = shopCustomer.default_address.address1;
    if (shopCustomer.default_address.address2) {
      ret.address2 = shopCustomer.default_address.address2;
    }
    ret.zip = shopCustomer.default_address.zip;
    ret.city = shopCustomer.default_address.city;
    ret.country = shopCustomer.default_address.country;
    return ret;
  }

  if (order.shipping_address) {
    if (order.shipping_address.company) {
      ret.company = order.shipping_address.company;
    }
    ret.address1 = order.shipping_address.address1;
    if (order.shipping_address.address2) {
      ret.address2 = order.shipping_address.address2;
    }
    ret.zip = order.shipping_address.zip;
    ret.city = order.shipping_address.city;
    ret.country = order.shipping_address.country;
  }

  return ret;
}
