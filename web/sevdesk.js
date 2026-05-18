import sevDeskApi from "./sevdeskApi.js";

class SevDesk {
  constructor(api) {
    this.sevDesk = api;
  }
  getBillingAddress(order) {
    const shopCustomer = order.customer;
    var ret = {
      company: "",
      address1: "",
      address2: "",
      zip: "",
      city: "",
      country: "Germany",
    };

    if (order.billing_address) {
      if (order.billing_address?.company != null) {
        ret.company = order.billing_address.company;
      } else {
        ret.company = "";
      }
      ret.address1 = order.billing_address.address1;
      if (order.billing_address.address2) {
        ret.address2 = order.billing_address.address2;
      }
      ret.zip = order.billing_address.zip;
      ret.city = order.billing_address.city;
      ret.country = order.billing_address.country;
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

  formatDateTime(dateTimeString) {
    // Parse the input string into a Date object
    const date = new Date(dateTimeString);

    // Create the Intl.DateTimeFormat options
    const dateOptions = {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      timeZone: "Europe/Berlin",
    };
    const timeOptions = {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      timeZone: "Europe/Berlin",
    };

    // Format the date and time using the options
    const formattedDate = new Intl.DateTimeFormat("de-DE", dateOptions).format(
      date,
    );
    const formattedTime = new Intl.DateTimeFormat("de-DE", timeOptions).format(
      date,
    );

    return { formattedDate, formattedTime };
  }

  async checkIfDefaultContactExists() {
    const defaultContact = await this.sevDesk.getContactById("CPDCustomer");

    if (defaultContact.length === 0) {
      const newCustomer = {
        customerNumber: "CPDCustomer",
        surename: "Shopify",
        familyname: "Kunde",
        category: { id: 3, objectName: "Category" },
      };

      const customer = await this.sevDesk.createContact(newCustomer);

      const { id } = customer;
      const contactId = id;

      const customerAddress = {
        contact: { id: contactId, objectName: "Contact" },
        street: " ",
        zip: " ",
        city: " ",
        country: { id: 1, objectName: "StaticCountry" },
        name: " ",
      };

      await this.sevDesk.createContactAddress(customerAddress);
      await this.sevDesk.setCustomerEmail(contactId, " ");

      return customer;
    } else {
      return defaultContact[0];
    }
  }

  async createCustomer(order, shop_domain) {
    const shopCustomer = order.customer;
    let newCustomer = {
      customerNumber: shopCustomer.id,
      surename: shopCustomer.first_name,
      familyname: shopCustomer.last_name,
      category: { id: 3, objectName: "Category" },
    };

    //if shop_domain includes b2b add name of company to customer
    if (
      (shop_domain.includes("b2b") || shopCustomer.tags === "B2B") &&
      shopCustomer.current_company &&
      shopCustomer.current_company.name
    ) {
      newCustomer = {
        name: shopCustomer.current_company.name,
        customerNumber: shopCustomer.id,
        surename: shopCustomer.first_name,
        familyname: shopCustomer.last_name,
        tags: shopCustomer.tags,
        category: { id: 3, objectName: "Category" },
      };
    }

    try {
      let customer = await this.sevDesk.createContact(newCustomer);

      const { first_name, last_name, billing_address, default_address } =
        shopCustomer;
      const { id } = customer;

      // console.log(shopCustomer);

      let address = this.getBillingAddress(order);

      // console.log(address);

      const { company, address1, address2, zip, city, country } = address;
      const contactId = id;
      const countryId = await this.sevDesk.getCountryId(country);

      let customerAddress = {
        contact: { id: contactId, objectName: "Contact" },
        street: `${address1} ${address2}`,
        zip,
        city,
        country: { id: countryId, objectName: "StaticCountry" },
        name2: `${first_name} ${last_name}`,
      };

      if ((shop_domain.includes("b2b") || customer.tags === "B2B") && company) {
        customerAddress = {
          name: company,
          contact: { id: contactId, objectName: "Contact" },
          street: `${address1} ${address2}`,
          zip,
          city,
          country: { id: countryId, objectName: "StaticCountry" },
          name2: `${first_name} ${last_name}`,
        };
      }

      var customerEmail = shopCustomer.email;

      if (
        customerEmail === null ||
        customerEmail === undefined ||
        customerEmail === ""
      ) {
      }

      await this.sevDesk.createContactAddress(customerAddress);
      await this.sevDesk.setCustomerEmail(contactId, customerEmail);

      return customer;
    } catch (error) {
      console.error(error);
      return null;
    }
  }

  async updateCustomer(customer, order, shop_domain) {
    const shopCustomer = order.customer;
    try {
      const { id, surename, familyname } = customer;
      const contactId = id;

      let contact = shopCustomer;

      let customerId = "CPDCustomer";

      if (shopCustomer) {
        customerId = shopCustomer.id;
      } else {
        contact = {
          first_name: "Shopify",
          last_name: "Kunde",
        };
      }

      const { first_name, last_name } = contact;

      // console.log(customer, "customer");
      var communicationWay = await this.sevDesk.getEmail(customer.id);
      var email = communicationWay[0]?.value;
      console.log(communicationWay, "communicationWay");

      if (
        surename !== first_name ||
        familyname !== last_name ||
        email !== shopCustomer.email
      ) {
        let updatedCustomer = {
          customerNumber: customerId,
          surename: first_name,
          familyname: last_name,
          category: { id: 3, objectName: "Category" },
        };

        //if shop_domain includes b2b add name of company to customer
        if (
          (shop_domain.includes("b2b") || shopCustomer.tags.includes("B2B")) &&
          shopCustomer.current_company &&
          shopCustomer.current_company.name
        ) {
          updatedCustomer = {
            name: shopCustomer.current_company.name,
            customerNumber: customerId,
            surename: first_name,
            familyname: last_name,
            category: { id: 3, objectName: "Category" },
          };
        }

        customer = await this.sevDesk.updateContact(id, updatedCustomer);

        if (
          contact.email &&
          (email === null ||
            email === undefined ||
            email === "" ||
            email !== contact.email)
        ) {
          const updatedCommunicationWay = await this.sevDesk.setCustomerEmail(
            customer.id,
            contact.email,
          );
        } else if (
          email != null &&
          email != undefined &&
          email != "" &&
          email != contact.email
        ) {
          const updatedCommunicationWay =
            await this.sevDesk.updateCustomerEmail(communicationWay.id, email);
        }
      }

      //if address is different
      const address = this.getBillingAddress(order);

      const { company, address1, address2, zip, city, country } = address;

      if (country != "") {
        console.log("country: " + country);
        const countryId = await this.sevDesk.getCountryId(country);

        let customerAddress = {
          contact: { id: contactId, objectName: "Contact" },
          street: `${address1} ${address2}`,
          zip,
          city,
          country: { id: countryId, objectName: "StaticCountry" },
          name: company,
          name2: `${first_name} ${last_name}`,
        };

        let contactAddress = await this.sevDesk.getContactAddressByContactId(
          contactId,
        );

        console.log(contactAddress, "contactAddress");
        console.log(customerAddress, "customerAddress");

        if (contactAddress.length > 0) {
          const updatedAddress = await this.sevDesk.updateContactAddress(
            contactAddress[0].id,
            customerAddress,
          );
        } else {
          await this.sevDesk.createContactAddress(customerAddress);
        }
      }

      return customer;
    } catch (error) {
      console.error(error);
      return null;
    }
  }

  roundToTwoDecimals(value) {
    return Math.round(value * 100) / 100;
  }

  getPercentageFromTitle(title) {
    if (!title) return null;

    const match = title.match(/\((\d+)%\)/);
    // const match = title.match(/\((\d+)%\)/);
    if (match && match[1]) {
      return parseInt(match[1], 10);
    }
    return null;
  }

  async createInvoice(order, customer, shop_domain) {
    console.log("###############################createInvoice");
    const sevUser = await this.sevDesk.getSevUser();
    // console.log(sevUser,'sevUser*********')
    // const sevUserId = sevUser[0].id;
    const sevUserId = 836992;

    if (!customer.tags) {
      customer.tags = "test";
    }

    let number = await this.sevDesk.getOrderNumber();
    number = number.format.replace("%NUMBER", number.nextSequence);

    let marktplatz = "Shopify";

    if (order.note) {
      const note = order.note;
      const marktplatzIndex = note.indexOf("Marktplatz:");
      if (marktplatzIndex !== -1) {
        const endOfLineIndex = note.indexOf("\n", marktplatzIndex);
        const value = note.substring(
          marktplatzIndex + "Marktplatz:".length,
          endOfLineIndex,
        );
        marktplatz = value.trim();
      }
    }

    let paidStatus = "200";

    if (
      order.fulfillment_status == "fulfilled" ||
      order.fulfillment_status == "partial"
    ) {
      paidStatus = "200";
    }

    const nl = "\n";

    let addressFields = this.getBillingAddress(order);

    let { company, address1, address2, zip, city, country } = addressFields;

    const countryId = await this.sevDesk.getCountryId(country);
    let vorname = "";
    if (customer.surename) {
      vorname = customer.surename + " ";
    }

    let nachname = "";
    if (customer.familyname) {
      nachname = customer.familyname;
    }

    let name = vorname + nachname;

    if (name === "" && customer.email) {
      name = customer.email;
    }

    if (order.note_attributes && order.note_attributes.length > 0) {
      const pickupLocationCompanyAttr = order.note_attributes.find(
        (attr) => attr.name === "Pickup-Location-Company",
      );
      const pickupLocationCompany = pickupLocationCompanyAttr?.value;
      const isSameCompany = pickupLocationCompany === company;

      if (isSameCompany) {
        company = "";
      }
    }

    const address = [company, name, address1, address2, zip, city]
      .filter(Boolean)
      .join(nl);

    const { formattedDate, formattedTime } = this.formatDateTime(
      order.created_at,
    );

    let totalPrice = 0.0;
    let totalDiscount = 0.0;

    const variantTitle = order?.line_items[0].variant_title;
    console.log(variantTitle, "variantTitle***************");

    let variant_type = this.getPercentageFromTitle(variantTitle);
    console.log(variant_type, "variant_type***************");

    // order.line_items.forEach((item) => {
    //   const { quantity, price } = item;
    //   totalPrice += quantity * price;

    //   item.discount_allocations.forEach((discount) => {
    //     totalDiscount += parseFloat(discount.amount);
    //   });
    // });

    let LineItemsDiscountCode = null;
    order.line_items.forEach((item) => {
      const { quantity, price } = item;
      totalPrice += quantity * price;

      item.discount_allocations.forEach((discountAlloc) => {
        const discountAmount = parseFloat(discountAlloc.amount);

        // Get index of the discount application
        const appIndex = discountAlloc.discount_application_index;

        // Match the actual discount application object
        const discountApp = order.discount_applications[appIndex];

        // Match discount code from application
        LineItemsDiscountCode = order.discount_codes.find(
          (dc) => dc.code === discountApp?.code,
        );

        totalDiscount += LineItemsDiscountCode ? 0.0 : discountAmount;
      });
    });

    const totalPriceWithTax = totalPrice / (1 + 19 / 100);

    //if b2b
    let totalTax = totalPrice - totalPriceWithTax;
    if (shop_domain.includes("b2b") || customer.tags.includes("B2B")) {
      totalTax = order.total_tax;
    }

    let hasMwStBefreiung = false;

    if (order.discount_applications) {
      order.discount_applications.forEach((app) => {
        if (app.title && app.title.toLowerCase().includes("mwst")) {
          hasMwStBefreiung = true;
        }
      });
    }

    if (order.discounts) {
      order.discounts.forEach((discount) => {
        if (discount.code && discount.code.toLowerCase().includes("mwst")) {
          hasMwStBefreiung = true;
        }
      });
    }

    if (!hasMwStBefreiung) {
      hasMwStBefreiung = Math.abs(totalDiscount - totalTax) < 0.01;
    }

    console.log(hasMwStBefreiung, "hasMwStBefreiung");

    console.log("brutto: " + totalPrice);
    console.log("totalDiscount: " + totalDiscount);
    console.log("netto: " + totalPriceWithTax);
    console.log("totalTax: " + totalTax);

    // const taxText = hasMwStBefreiung
    //   ? "Steuerfrei 0% lt. § 12 Absatz 3 UStG"
    //   : "zzgl. Umsatzsteuer 19%";
    // const taxId = hasMwStBefreiung ? "83858" : "83859";
    // //const taxId = hasMwStBefreiung ? "88970" : "88971";

    // const taxRate = hasMwStBefreiung ? "0" : "19";
    console.log(variant_type, "variant type checking****************");
    let taxText =
      variant_type === null || variant_type === 0
        ? "Steuerfrei 0% lt. § 12 Absatz 3 UStG"
        : "zzgl. Umsatzsteuer 19%";

    let taxId = variant_type === null || variant_type === 0 ? "83858" : "83859";

    if (taxText === "zzgl. Umsatzsteuer 19%" && customer.tags.includes("B2B")) {
      taxText = "Umsatzsteuer 19%";
    }

    //const taxId = hasMwStBefreiung ? "88970" : "88971";

    let taxRate = variant_type === null || variant_type === 0 ? "0" : "19";
    console.log(
      taxText,
      taxId,
      taxRate,
      "variant type checking****************",
    );

    if (order.source_name === "pos" && order.financial_status === "pending") {
      // taxText = "Steuerfrei 0% lt. § 12 Absatz 3 UStG";
      // taxId = "83858";
      // taxRate = "0";
    }

    let kundenVorname = "Shopify";
    let kundenNachname = "Kunde";

    if (customer.surename) {
      kundenVorname = customer.surename + " ";
    }

    if (customer.familyname) {
      kundenNachname = customer.familyname;
    }

    let headText = `<em>Hallo ${kundenVorname} ${kundenNachname},  \t vielen Dank für Ihre Bestellung vom ${formattedDate} um ${formattedTime} Uhr.  \t Sie erhalten heute Ihre Rechnung über die folgenden Positionen zu Auftrag ${order.name}.</em>`;

    //if shop_domain contains b2b
    console.log("shop_domain: " + shop_domain);
    let footText =
      "Bitte überweisen Sie den Rechnungsbetrag unter Angabe der Rechnungsnummer auf das unten angegebene Konto. Der Rechnungsbetrag ist sofort fällig.";
    if (shop_domain.includes("b2b") || customer.tags.includes("B2B")) {
      footText =
        "\nFür B2b Kunden (sollten Sie nicht schon im Shop bezahlt haben): Der Gesamtbetrag ist ohne Abzug innerhalb von 7 Tagen zahlbar. Die Warenausgabe am Abholtag ist ausschließlich für die vollständig im Voraus bezahlten Bestellungen möglich. Sollte nach 7 Tagen kein Zahlungseingang zu verzeichnen sein, wird die Bestellung automatisch storniert.";
    } else {
      footText = `\r\nSollten Sie bereits im Onlineshop an der Kassa bezahlt haben, bitte betrachten Sie diese Rechnung als bezahlt.\nMit der Begleichung dieser Rechnung bestätigt der Kunde, unsere Allgemeinen Geschäftsbedingungen (AGBs) gelesen, verstanden und akzeptiert zu haben. Unsere AGBs können jederzeit auf unserer Webseite (https://isolarpro.de/policies/terms-of-service) eingesehen werden.\n`;
    }

    // if (hasMwStBefreiung) {
    footText += `\n\nDie Mehrwertsteuerbefreiung - Auszug Umsatzsteuergesetz - gemäß §12 Absatz 3 UStG: „Die Steuer ermäßigt sich auf 0 Prozent für die folgenden Umsätze:\n\n1. Die Lieferungen von Solarmodulen an den Betreiber einer Photovoltaikanlage, einschließlich der für den Betrieb einer Photovoltaikanlage wesentlichen Komponenten und der Speicher, die dazu dienen, den mit Solarmodulen erzeugten Strom zu speichern, wenn die Photovoltaikanlage auf oder in der Nähe von Privatwohnungen, Wohnungen sowie öffentlichen und anderen Gebäuden, die für dem Gemeinwohl dienende Tätigkeiten genutzt werden, installiert wird. Die Voraussetzungen des Satzes 1 gelten als erfüllt, wenn die installierte Bruttoleistung der Photovoltaikanlage laut Marktstammdatenregister nicht mehr als 30 Kilowatt (peak) beträgt oder betragen wird;\n2. Den innergemeinschaftlichen Erwerb der in Nummer 1 bezeichneten Gegenstände, die die Voraussetzungen der Nummer 1 erfüllen;\n3. Die Einfuhr der in Nummer 1 bezeichneten Gegenstände, die die Voraussetzungen der Nummer 1 erfüllen;\n4. Die Installation von Photovoltaikanlagen sowie der Speicher, die dazu dienen, den mit Solarmodulen erzeugten Strom zu speichern, wenn die Lieferung der installierten Komponenten die Voraussetzungen der Nummer 1 erfüllt.“\n\nSie haben bestätigt, dass Sie die Voraussetzungen für die Befreiung von Mehrwertsteuer gemäß §12 Absatz 3 Umsatzsteuergesetz erfüllen, und dass die Liefer- und Rechnungsadressen in Deutschland liegen. Im Falle, dass diese Bedingungen nicht erfüllt werden, sind wir berechtigt, eine Mehrwertsteuer von 19% nachzuberechnen. Bitte informieren Sie uns sofort, falls dies der Fall ist."`;
    // }

    footText += `<br/><b>Bestellung von: ${marktplatz}</b>`;
    let invoiceData = {
      invoice: {
        header: `Rechnung Nr. ${number}`,
        headText,
        footText,
        invoiceDate: order.created_at,
        contact: { id: customer.id, objectName: "Contact" },
        status: paidStatus,
        address,
        addressCountry: { id: countryId, objectName: "StaticCountry" },
        contactPerson: { id: sevUserId, objectName: "SevUser" },
        paymentMethod: { id: "21919", objectName: "PaymentMethod" },
        taxRate,
        taxText,
        showNet: "0",
        taxType: "custom",
        taxSet: { id: taxId, objectName: "TaxSet" },
        invoiceType: "RE",
        currency: "EUR",
        mapAll: "true",
        id: null,
        invoiceNumber: number,
        objectName: "Invoice",
        customerInternalNote: order.id,
      },
      invoicePosSave: [],
    };

    //if b2b
    if (shop_domain.includes("b2b") || customer.tags.includes("B2B")) {
      invoiceData = {
        invoice: {
          header: `Rechnung Nr. ${number}`,
          headText,
          footText,
          invoiceDate: order.created_at,
          contact: { id: customer.id, objectName: "Contact" },
          status: paidStatus,
          address,
          addressCountry: { id: countryId, objectName: "StaticCountry" },
          contactPerson: { id: sevUserId, objectName: "SevUser" },
          paymentMethod: { id: "21919", objectName: "PaymentMethod" },
          taxRate,
          taxText,
          taxType: "custom",
          showNet: "0",
          taxSet: { id: taxId, objectName: "TaxSet" },
          invoiceType: "RE",
          currency: "EUR",
          mapAll: "true",
          id: null,
          invoiceNumber: number,
          objectName: "Invoice",
          customerInternalNote: order.id,
        },
        invoicePosSave: [],
      };
    }

    let discountedTotalPrice = 0;
    let roundedTotalPrice = 0;

    let totalTaxBeforeRounding = 0.0; // initialize it to 0
    let roundedTotalTax = 0.0; // initialize it to 0

    let MehrwertsteuerTrueB2B = false;
    let MehrwertsteuerTrueB2BAmount = false;
    order.line_items.forEach((item) => {
      if (item.title === "Mehrwertsteuer 19%") {
        MehrwertsteuerTrueB2B = true;
        MehrwertsteuerTrueB2BAmount = item.price * item.quantity;
        // totalDiscount -= item.price * item.quantity;
      }
      //       if (
      //   item.title === "Mehrwertsteuer 19%" &&
      //   order.total_discounts === "0.00"
      // ) {
      //   MehrwertsteuerTrueB2B = true;
      //   MehrwertsteuerTrueB2BAmount = item.price * item.quantity;

      //   totalDiscount -= item.price * item.quantity;
      // }
    });

    console.log("totalDiscount after mwst check: " + totalDiscount);

    let totalLineItemsPrice = MehrwertsteuerTrueB2BAmount;
    let totalLineItemsPriceAdjust = 0;
    let lineItemsTotal = 0;
    order.line_items.forEach((item) => {
      console.log(
        "item:********** ",
        item.title,
        item.title === "Mehrwertsteuer 19%",
      );
      // if (
      //   (shop_domain.includes("b2b") || customer.tags.includes("B2B")) &&
      //   item.title === "Mehrwertsteuer 19%"
      // ) {
      //   return;
      // }
      // if (item.title === "Mehrwertsteuer 19%") return;

      // Skip VAT line only for B2B

      console.log(
        "item:********** ",
        item.title,
        item.title === "Mehrwertsteuer 19%",
      );
      console.log(
        "shop_domain.includes('b2b'------------------>s)",
        shop_domain.includes("b2b"),
        "customer.tags.includes('B2B')",
        customer.tags.includes("B2B"),
      );
      // if (item.title === "Mehrwertsteuer 19%") return;

      let { quantity, price, title } = item;

      // --------------------
      const itemVariantType = this.getPercentageFromTitle(item.variant_title);

      const itemTaxRate =
        itemVariantType === null || itemVariantType === 0 ? "0" : "19";

      // ----- 1. PROPORTIONAL DISCOUNT -----
      const proportionalDiscount =
        ((quantity * price) / totalPrice) * totalDiscount;

      const grossDiscounted = price - proportionalDiscount / quantity;
      const grossRounded = Math.round(grossDiscounted * 100) / 100;

      // ----- 2. NET / GROSS VALUES -----
      // let net = grossRounded / (1 + taxRate / 100);
      let net = grossRounded / (1 + itemTaxRate / 100);
      let gross = grossRounded;

      // ----- 3. B2B LOGIC (USE NET PRICES) -----
      const isB2B =
        shop_domain.includes("b2b") || (customer?.tags || []).includes("B2B");

      console.log("grossRounded", isB2B, grossRounded, taxRate);

      if (isB2B) {
        net = price;
        gross = price;
      }
      //       if (isB2B) {
      //   net = parseFloat(price);

      //   gross =
      //     item.title === "Mehrwertsteuer 19%"
      //       ? net
      //       : net * (1 + itemTaxRate / 100);
      // }

      // if (isB2B && MehrwertsteuerTrueB2B && order.total_discounts === "0.00") {
      //   const productLines = order.line_items.filter(
      //     (i) => i.title !== "Mehrwertsteuer 19%",
      //   );
      //   const productCount = productLines.length;

      //   let vatShare = MehrwertsteuerTrueB2BAmount / productCount;

      //   // Round the share normally
      //   vatShare = Math.round(vatShare * 1000) / 1000 / quantity;

      //   // Detect LAST PRODUCT to fix remainder
      //   const isLast =
      //     productLines[productCount - 1].title === item.title &&
      //     productLines[productCount - 1].price === item.price;

      //   totalLineItemsPrice += price * quantity;
      //   // Remainder (positive or negative)

      //   net = parseFloat(price) + vatShare;
      //   gross = net;

      //   totalLineItemsPriceAdjust += gross * quantity;

      //   console.log(
      //     "VAT SHARE (adjusted)",
      //     isLast,
      //     net,
      //     totalLineItemsPrice.toFixed(2),
      //     totalLineItemsPriceAdjust,
      //     totalLineItemsPriceAdjust.toFixed(2),
      //   );

      //   if (isLast) {
      //     totalLineItemsPriceAdjust -= parseFloat(
      //       LineItemsDiscountCode?.amount || 0,
      //     );
      //   }

      //   const remainder = isLast
      //     ? totalLineItemsPrice.toFixed(2) -
      //       Math.floor(totalLineItemsPriceAdjust * 100) / 100
      //     : 0;

      //   console.log("REMAINDER", remainder);

      //   if (isLast && remainder !== 0) {
      //     const perUnitAdj = remainder / quantity;
      //     net = parseFloat(price) + vatShare - perUnitAdj;
      //     gross = net;
      //   }
      // }

      if (!isB2B) {
        const productLines = order.line_items.filter(
          (i) => i.title !== "Mehrwertsteuer 19%",
        );

        const productCount = productLines.length;
        const isLast =
          productLines[productCount - 1].title === item.title &&
          productLines[productCount - 1].price === item.price;

        // keep raw float sum (NOT rounded)
        totalLineItemsPriceAdjust += gross * quantity;

        // actual invoice target sum (NO VAT, NON-B2B)
        const targetTotal = Number(
          order.current_subtotal_price_set.shop_money.amount,
        );

        // compute remainder using exact float difference
        let remainder = 0;

        console.log(
          "VAT SHARE (adjusted)",
          isLast,
          net,
          targetTotal,
          totalLineItemsPriceAdjust,
          totalLineItemsPriceAdjust.toFixed(2),
        );

        if (isLast) {
          totalLineItemsPriceAdjust -= parseFloat(
            LineItemsDiscountCode?.amount || 0,
          );
          remainder = Number(
            (targetTotal - totalLineItemsPriceAdjust).toFixed(2),
          );
          const perUnitFix = remainder / quantity;

          console.log("NON-B2B REMAINDER =", remainder);

          if (remainder !== 0) {
            net = Number((net + perUnitFix).toFixed(2));
            gross = Number((gross + perUnitFix).toFixed(2));
          }
        }
      }

      console.log("FINAL VALUES", net, gross);

      // ----- 4. BUILD THE INVOICE POSITION -----
      const invoicePos = {
        objectName: "InvoicePos",
        mapAll: true,
        quantity,
        price: net,
        priceGross: gross,
        // taxRate: isB2B ? taxRate : taxRate,
        // taxRate: isB2B ? taxRate : itemTaxRate,
        // taxRate:
        //   item.title === "Mehrwertsteuer 19%"
        //     ? "0"
        //     : isB2B
        //     ? taxRate
        //     : itemTaxRate,
        taxRate: item.title === "Mehrwertsteuer 19%" ? "0" : itemTaxRate,
        name: title,
        unity: { id: 1, objectName: "Unity" },
      };
      lineItemsTotal += Number(gross).toFixed(2) * quantity;
      invoiceData.invoicePosSave.push(invoicePos);
    });

    //if foreach order.discount_applications is not empty and has item with title "Benutzerdefinierter Rabatt"
    let discountSave = [];

    if (order.discount_applications.length > 0) {
      order.discount_applications.forEach((item) => {
        //if item.title to lower doesnt contain "mwst" or "mehrwertsteuer"

        // if (!item.title.toLowerCase().includes("mwst") && !item.title.toLowerCase().includes("mehrwertsteuer") && item.value_type == "fixed_amount") {
        if (
          item.title == "Benutzerdefinierter Rabatt" &&
          item.value_type == "fixed_amount"
        ) {
          let { value } = item;

          if (
            Number(order?.total_discounts_set?.shop_money.amount) >
            Number(order.total_price)
          ) {
            MehrwertsteuerTrueB2B = false;
            invoiceData.invoice.showNet = "1";
          }

          if (customer.tags.includes("B2B")) {
            discountSave = [
              {
                objectName: "Discounts",
                mapAll: true,
                discount: true,
                value: MehrwertsteuerTrueB2B
                  ? order?.total_discounts_set?.shop_money.amount -
                    MehrwertsteuerTrueB2BAmount
                  : order?.total_discounts_set?.shop_money.amount,
                text: "B2B Rabatt",
                percentage: false,
              },
            ];
          } else {
            discountSave.push({
              objectName: "Discounts",
              mapAll: true,
              discount: true,
              value,
              text: customer.tags.includes("B2B")
                ? "B2B Rabatt"
                : "Benutzerdefinierter Rabatt",
              percentage: false,
            });
          }
        } else if (
          (shop_domain.includes("b2b") || customer.tags.includes("B2B")) &&
          !(item.title || "").toLowerCase().includes("mwst") &&
          !(item.title || "").toLowerCase().includes("mehrwertsteuer") &&
          item.value_type == "fixed_amount" &&
          item.type == "manual"
        ) {
          let { value } = item;
          if (customer.tags.includes("B2B")) {
            discountSave = [
              {
                objectName: "Discounts",
                mapAll: true,
                discount: true,
                value: order?.total_discounts_set?.shop_money.amount,
                text: "B2B Rabatt",
                percentage: false,
              },
            ];
          } else {
            discountSave.push({
              objectName: "Discounts",
              mapAll: true,
              discount: true,
              value,
              text: customer.tags.includes("B2B")
                ? "B2B Rabatt"
                : "Benutzerdefinierter Rabatt",
              percentage: false,
            });
          }
        }

        if (
          LineItemsDiscountCode &&
          LineItemsDiscountCode?.code === item.code
        ) {
          console.log(
            "LineItemsDiscountCode matched: ",
            LineItemsDiscountCode,
            item,
          );
          discountSave.push({
            objectName: "Discounts",
            mapAll: true,
            discount: true,
            value: LineItemsDiscountCode?.amount,
            text: "Rabattcode: " + LineItemsDiscountCode?.code,
            percentage: false,
          });
        }
      });
    }

    if (
      !LineItemsDiscountCode &&
      discountSave.length === 0 &&
      lineItemsTotal > order.current_subtotal_price_set.shop_money.amount
    ) {
      discountSave.push({
        objectName: "Discounts",
        mapAll: true,
        discount: true,
        value: parseFloat(
          lineItemsTotal - order.current_subtotal_price_set.shop_money.amount,
        ).toLocaleString(),
        text: "Rabatt",
        percentage: false,
      });
    }

    if (discountSave.length > 0) {
      invoiceData.discountSave = discountSave;
    }

    // Adjust the rounding difference for the last invoice position
    // Adjust the rounding difference for the last invoice position
    const roundingDifference = discountedTotalPrice - roundedTotalPrice;

    //if b2b
    if (!shop_domain.includes("b2b")) {
      let lastInvoicePos =
        invoiceData.invoicePosSave[invoiceData.invoicePosSave.length - 1];
      lastInvoicePos.price += roundingDifference / lastInvoicePos.quantity;
      lastInvoicePos.priceGross += roundingDifference / lastInvoicePos.quantity; // Update the priceGross as well
    }
    const taxRoundingDifference = totalTax - roundedTotalTax;
    console.log(taxRoundingDifference, "taxRoundingDifference");

    // let priceTaxTotal = 0;
    // while(priceTaxTotal != totalTax) {
    //     priceTaxTotal = 0;
    //     for(let i = 0; i < invoiceData.invoicePosSave.length; i++) {
    //         priceTaxTotal += invoiceData.invoicePosSave[i].priceTax * invoiceData.invoicePosSave[i].quantity;
    //     }
    //     priceTaxTotal = Math.round(priceTaxTotal * 100) / 100;
    //     if(priceTaxTotal > totalTax) {
    //         invoiceData.invoicePosSave[invoiceData.invoicePosSave.length - 1].priceTax -= 0.0001;
    //     } else if(priceTaxTotal < totalTax) {
    //         invoiceData.invoicePosSave[invoiceData.invoicePosSave.length - 1].priceTax += 0.0001;
    //     }
    // }

    if ("total_shipping_price_set" in order) {
      const shippingFee = parseFloat(
        order.total_shipping_price_set.shop_money.amount,
      );
      if (shippingFee > 0) {
        // console.log(taxRate);
        let taxRateNum = parseFloat(taxRate);
        let shippingNet =
          taxRateNum === 19 ? shippingFee / (1 + taxRate / 100) : shippingFee;

        let invoicePos = {
          objectName: "InvoicePos",
          mapAll: true,
          quantity: 1,
          price: shippingNet, // Verwenden Sie den Nettobetrag
          priceGross: shippingFee, // Bruttobetrag bleibt gleich
          taxRate: taxRate, // Verwenden Sie die Steuerrate
          name: "Versand",
          priceTax: shippingFee - shippingNet, // Mehrwertsteuer für den Versand
          unity: { id: 1, objectName: "Unity" },
        };

        invoiceData.invoicePosSave.push(invoicePos);
      }
    }

    // console.log(discountedTotalPrice, "discountedTotalPrice");
    // console.log(roundedTotalPrice + roundingDifference, "roundedTotalPrice (adjusted)");
    // console.log(totalTaxBeforeRounding, "totalTaxBeforeRounding");
    // console.log(roundedTotalTax + taxRoundingDifference, "roundedTotalTax (adjusted)");

    // invoiceData.discountSave = [ {
    //     "discount": "true",
    //     "text": "Rabatt",
    //     "percentage": false,
    //     "value": discountAmount,
    //     "objectName": "Discounts",
    //     "mapAll": "true"
    // }];

    console.log("invoiceData", invoiceData);
    // return invoiceData;
    //     const invoice = await this.sevDesk.createInvoice(invoiceData);
    //     console.log(
    //   JSON.stringify(invoiceData.invoicePosSave, null, 2)
    // );

    // return invoiceData;
    // }
    //   console.log(
    //     "FINAL FULL INVOICE JSON",
    //     JSON.stringify(invoiceData, null, 2),
    //   );
    // }

    const invoice = await this.sevDesk.createInvoice(invoiceData);
    console.log("invoice", invoice);

    return invoice.invoice;
  }

  // return {
  //   debug: true,
  //   invoiceData
  // };
  // const invoice = await this.sevDesk.createInvoice(invoiceData);
  //   console.log("invoice", invoice);

  //   return invoice.invoice;

  // }
  //   console.log(
  // //   JSON.stringify(invoiceData, null, 2)
  // );
  // const invoice = await this.sevDesk.createInvoice(invoiceData);
  //   console.log("invoice", invoice);

  //   return invoice.invoice;
  // }

  //   console.log("invoice", invoice);

  //   return invoice.invoice;
  // }

  async updateInvoice(order, customer, existingInvoice, shop_domain) {
    const sevUser = await this.sevDesk.getSevUser();
    // const sevUserId = sevUser[0].id;
    const sevUserId = 836992;

    if (!customer.tags) {
      customer.tags = "test";
    }

    let number = await this.sevDesk.getOrderNumber();
    number = number.format.replace("%NUMBER", number.nextSequence);

    let totalPrice = 0.0;
    let totalDiscount = 0.0;

    const variantTitle = order?.line_items[0].variant_title;
    console.log(variantTitle, "variantTitle***************");

    let variant_type = this.getPercentageFromTitle(variantTitle);
    console.log(variant_type, "variant_type***************");

    order.line_items.forEach((item) => {
      const { quantity, price } = item;
      totalPrice += quantity * price;

      item.discount_allocations.forEach((discount) => {
        totalDiscount += parseFloat(discount.amount);
      });
    });

    const totalPriceWithTax = totalPrice / (1 + 19 / 100);
    const totalTax = totalPrice - totalPriceWithTax;

    let hasMwStBefreiung = false;

    if (order.discount_applications) {
      order.discount_applications.forEach((app) => {
        if (app.title && app.title.toLowerCase().includes("mwst")) {
          hasMwStBefreiung = true;
        }
      });
    }

    if (order.discounts) {
      order.discounts.forEach((discount) => {
        if (discount.code && discount.code.toLowerCase().includes("mwst")) {
          hasMwStBefreiung = true;
        }
      });
    }

    if (!hasMwStBefreiung) {
      hasMwStBefreiung = Math.abs(totalDiscount - totalTax) < 0.01;
    }
    // let taxRate = hasMwStBefreiung ? "0" : "19";
    // let taxText = hasMwStBefreiung
    //   ? "Steuerfrei 0% lt. § 12 Absatz 3 UStG"
    //   : "zzgl. Umsatzsteuer 19%";
    // let taxId = hasMwStBefreiung ? "83858" : "83859";
    console.log(variant_type, "variant type checking****************");
    let taxText =
      variant_type === null || variant_type === 0
        ? "Steuerfrei 0% lt. § 12 Absatz 3 UStG"
        : "zzgl. Umsatzsteuer 19%";

    let taxId = variant_type === null || variant_type === 0 ? "83858" : "83859";

    if (taxText === "zzgl. Umsatzsteuer 19%" && customer.tags.includes("B2B")) {
      taxText = "Umsatzsteuer 19%";
    }

    //const taxId = hasMwStBefreiung ? "88970" : "88971";

    let taxRate = variant_type === null || variant_type === 0 ? "0" : "19";
    console.log(
      taxText,
      taxId,
      taxRate,
      "variant type checking****************",
    );

    //const taxId = hasMwStBefreiung ? "88970" : "88971";
    // const taxId = hasMwStBefreiung ? "86295" : "86294";
    // const taxId = hasMwStBefreiung ? "84290" : "84291";
    console.log(taxText, "taxText application*******************847");

    if (order.source_name === "pos" && order.financial_status === "pending") {
      console.log(
        "@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@update invoice api**************",
      );
      // taxText = "Steuerfrei 0% lt. § 12 Absatz 3 UStG";
      // taxId = "83858";
      // taxRate = "0";
    }

    let kundenVorname = "Shopify";
    let kundenNachname = "Kunde";

    if (customer.surename) {
      kundenVorname = customer.surename + " ";
    }

    if (customer.familyname) {
      kundenNachname = customer.familyname;
    }

    const { formattedDate, formattedTime } = this.formatDateTime(
      order.created_at,
    );

    let headText = `<em>Hallo ${kundenVorname} ${kundenNachname},  \t vielen Dank für Ihre Bestellung vom ${formattedDate} um ${formattedTime} Uhr.  \t Sie erhalten heute Ihre Rechnung über die folgenden Positionen zu Auftrag ${order.name}.</em>`;

    //if shop_domain contains b2b
    console.log("shop_domain: " + shop_domain);
    let footText =
      "Bitte überweisen Sie den Rechnungsbetrag unter Angabe der Rechnungsnummer auf das unten angegebene Konto. Der Rechnungsbetrag ist sofort fällig.";
    if (shop_domain.includes("b2b") || customer.tags === "B2B") {
      footText =
        "Für B2b Kunden (sollten Sie nicht schon im Shop bezahlt haben): Der Gesamtbetrag ist ohne Abzug innerhalb von 7 Tagen zahlbar. Die Warenausgabe am Abholtag ist ausschließlich für die vollständig im Voraus bezahlten Bestellungen möglich. Sollte nach 7 Tagen kein Zahlungseingang zu verzeichnen sein, wird die Bestellung automatisch storniert.";
    } else {
      footText = `\r\nSollten Sie bereits im Onlineshop an der Kassa bezahlt haben, bitte betrachten Sie diese Rechnung als bezahlt.\nMit der Begleichung dieser Rechnung bestätigt der Kunde, unsere Allgemeinen Geschäftsbedingungen (AGBs) gelesen, verstanden und akzeptiert zu haben. Unsere AGBs können jederzeit auf unserer Webseite (https://isolarpro.de/policies/terms-of-service) eingesehen werden.\n`;
    }

    footText += `\n\nDie Mehrwertsteuerbefreiung - Auszug Umsatzsteuergesetz - gemäß §12 Absatz 3 UStG: „Die Steuer ermäßigt sich auf 0 Prozent für die folgenden Umsätze:\n\n1. Die Lieferungen von Solarmodulen an den Betreiber einer Photovoltaikanlage, einschließlich der für den Betrieb einer Photovoltaikanlage wesentlichen Komponenten und der Speicher, die dazu dienen, den mit Solarmodulen erzeugten Strom zu speichern, wenn die Photovoltaikanlage auf oder in der Nähe von Privatwohnungen, Wohnungen sowie öffentlichen und anderen Gebäuden, die für dem Gemeinwohl dienende Tätigkeiten genutzt werden, installiert wird. Die Voraussetzungen des Satzes 1 gelten als erfüllt, wenn die installierte Bruttoleistung der Photovoltaikanlage laut Marktstammdatenregister nicht mehr als 30 Kilowatt (peak) beträgt oder betragen wird;\n2. Den innergemeinschaftlichen Erwerb der in Nummer 1 bezeichneten Gegenstände, die die Voraussetzungen der Nummer 1 erfüllen;\n3. Die Einfuhr der in Nummer 1 bezeichneten Gegenstände, die die Voraussetzungen der Nummer 1 erfüllen;\n4. Die Installation von Photovoltaikanlagen sowie der Speicher, die dazu dienen, den mit Solarmodulen erzeugten Strom zu speichern, wenn die Lieferung der installierten Komponenten die Voraussetzungen der Nummer 1 erfüllt.“\n\nSie haben bestätigt, dass Sie die Voraussetzungen für die Befreiung von Mehrwertsteuer gemäß §12 Absatz 3 Umsatzsteuergesetz erfüllen, und dass die Liefer- und Rechnungsadressen in Deutschland liegen. Im Falle, dass diese Bedingungen nicht erfüllt werden, sind wir berechtigt, eine Mehrwertsteuer von 19% nachzuberechnen. Bitte informieren Sie uns sofort, falls dies der Fall ist."`;

    let paidStatus = "200";

    if (
      order.fulfillment_status === "fulfilled" ||
      order.fulfillment_status === "partial"
    ) {
      paidStatus = "200";
    }

    const nl = "\n";

    const addressFields = this.getBillingAddress(order);

    const { company, address1, address2, zip, city, country } = addressFields;

    const countryId = await this.sevDesk.getCountryId(country);

    const existingInvoicePos = await this.sevDesk.getInvoicePositionsById(
      existingInvoice.id,
    );

    const name = customer.surename + " " + customer.familyname;

    console.log("name: " + name);

    const address = [company, name, address1, address2, zip, city]
      .filter(Boolean)
      .join(nl);

    console.log("address: " + address);

    console.log(existingInvoice.invoiceNumber);

    let invoiceData = {
      invoice: {
        header: `Rechnung Nr. ${existingInvoice.invoiceNumber}`,
        contact: { id: customer.id, objectName: "Contact" },
        status: paidStatus,
        address,
        addressCountry: { id: countryId, objectName: "StaticCountry" },
        contactPerson: { id: sevUserId, objectName: "SevUser" },
        paymentMethod: { id: "21919", objectName: "PaymentMethod" },
        taxRate,
        taxText,
        showNet: "0",
        taxType: "custom",
        taxSet: { id: taxId, objectName: "TaxSet" },
        invoiceType: "RE",
        currency: "EUR",
        mapAll: "true",
        id: existingInvoice.id,
        invoiceNumber: existingInvoice.invoiceNumber,
        objectName: "Invoice",
        customerInternalNote: order.id,
      },
    };

    if (shop_domain.includes("b2b") || customer.tags === "B2B") {
      invoiceData = {
        invoice: {
          header: `Rechnung Nr. ${number}`,
          headText,
          footText,
          invoiceDate: order.created_at,
          contact: { id: customer.id, objectName: "Contact" },
          status: paidStatus,
          address,
          addressCountry: { id: countryId, objectName: "StaticCountry" },
          contactPerson: { id: sevUserId, objectName: "SevUser" },
          paymentMethod: { id: "21919", objectName: "PaymentMethod" },
          taxRate,
          taxText,
          taxType: "custom",
          showNet: "0",
          taxSet: { id: taxId, objectName: "TaxSet" },
          invoiceType: "RE",
          currency: "EUR",
          mapAll: "true",
          id: null,
          invoiceNumber: number,
          objectName: "Invoice",
          customerInternalNote: order.id,
        },
        invoicePosSave: [],
      };
    }

    if (paidStatus === "100") {
      invoiceData.invoicePosSave = [];

      const refundedQuantities = {};
      order.refunds.forEach((refund) => {
        refund.refund_line_items.forEach((refundedItem) => {
          refundedQuantities[refundedItem.line_item.id] =
            (refundedQuantities[refundedItem.line_item.id] || 0) +
            refundedItem.quantity;
        });
      });

      let discountedTotalPrice = 0;
      let roundedTotalPrice = 0;

      order.line_items.forEach((item) => {
        const { quantity, price, title, total_discount } = item;

        const refundedQuantity = refundedQuantities[item.id] || 0;

        // Calculate the remaining quantity after refunds
        const remainingQuantity = quantity - refundedQuantity;

        // Only create an invoice position if the remaining quantity is greater than 0
        if (remainingQuantity > 0) {
          let proportionalDiscount =
            ((quantity * price) / totalPrice) * totalDiscount;

          const discountedPrice = parseFloat(
            price - proportionalDiscount / quantity,
          );
          const roundedDiscountedPrice =
            Math.round(discountedPrice * 100) / 100;

          discountedTotalPrice += discountedPrice * quantity;
          roundedTotalPrice += roundedDiscountedPrice * quantity;

          const priceTax =
            roundedDiscountedPrice -
            roundedDiscountedPrice / (1 + taxRate / 100);

          let invoicePos = {
            objectName: "InvoicePos",
            mapAll: true,
            quantity,
            price: roundedDiscountedPrice / (1 + taxRate / 100),
            priceGross: roundedDiscountedPrice,
            taxRate,
            name: title,
            priceTax,
            unity: { id: 1, objectName: "Unity" },
          };

          if (shop_domain.includes("b2b") || customer.tags === "B2B") {
            invoicePos = {
              objectName: "InvoicePos",
              mapAll: true,
              quantity,
              price: item.price,
              priceGross: item.price,
              taxRate,
              name: title,
              priceTax: item.price - item.price / (1 + taxRate / 100),
              unity: { id: 1, objectName: "Unity" },
            };
          }

          invoiceData.invoicePosSave.push(invoicePos);
        }
      });

      // Adjust the rounding difference for the position with the highest value
      const roundingDifference = discountedTotalPrice - roundedTotalPrice;
      let highestValueIndex = 0;
      let highestValue = 0;

      invoiceData.invoicePosSave.forEach((pos, index) => {
        const posValue = pos.price * pos.quantity;
        if (posValue > highestValue) {
          highestValue = posValue;
          highestValueIndex = index;
        }
      });

      const highestValuePos = invoiceData.invoicePosSave[highestValueIndex];
      highestValuePos.price += roundingDifference / highestValuePos.quantity;

      invoiceData.invoicePosDelete = existingInvoicePos;
    }

    console.log("invoiceData******************", invoiceData);

    const invoice = await this.sevDesk.createInvoice(invoiceData);

    if (invoice == null || invoice.invoice == null) {
      return null;
    }
    return invoice.invoice;
  }

  async bookInvoice(invoice) {
    try {
      const checkAccountID = await this.sevDesk.getCheckAccountID();
      const bookData = {
        amount: invoice.sumGross,
        date: new Date(),
        type: "N",
        checkAccount: {
          id: checkAccountID,
          objectName: "CheckAccount",
        },
      };

      const bookedInvoice = await this.sevDesk.bookInvoice(
        invoice.id,
        bookData,
      );

      return bookedInvoice;
    } catch (error) {
      console.error(error);
      return null;
    }
  }

  async createCreditNote(refund, order, customer, invoice) {
    console.log("createCreditNote", order);
    const sevUser = await this.sevDesk.getSevUser();
    // const sevUserId = sevUser[0].id;
    const sevUserId = 836992;

    let number = await this.sevDesk.getCreditNoteNumber();
    number = number.format.replace("%NUMBER", number.nextSequence);

    const invoiceNumber = number;

    const nl = "\n";
    const addressFields = this.getBillingAddress(order);
    const { company, address1, address2, zip, city, country } = addressFields;
    const countryId = await this.sevDesk.getCountryId(country);

    let vorname = "";
    if (customer.surename) {
      vorname = customer.surename + " ";
    }

    let nachname = "";
    if (customer.familyname) {
      nachname = customer.familyname;
    }
    let name = vorname + nachname;

    if (name === "" && customer.email) {
      name = customer.email;
    }

    // console.log(order);

    const address = [company, name, address1, address2, zip, city]
      .filter(Boolean)
      .join(nl);

    // let hasMwStBefreiung = order.discount_applications.some((app) =>
    //   app.title.toLowerCase().includes("mwst")
    // );
    let hasMwStBefreiung = order.discount_applications.some((app) => {
      const field = app?.title || ""; // fallback to empty string
      return field.toLowerCase().includes("mwst");
    });

    if (order.discounts) {
      hasMwStBefreiung = order.discounts.some((discount) =>
        discount.code.toLowerCase().includes("mwst"),
      );
    }

    console.log("hasMwStBefreiung", hasMwStBefreiung);

    const taxId = hasMwStBefreiung ? "83858" : "83859";

    // console.log("refund", refund);

    const { taxRate, taxText, taxSet } = invoice;
    // console.log("invoice", invoice);
    console.log("taxRate", taxRate);

    // console.log("taxRate", taxRate);
    // console.log("taxText", taxText);
    // console.log("taxSet", taxSet);

    let paidStatus = "200";

    let alreadyPayedAmount = 0;

    refund.transactions.forEach((transaction) => {
      if (transaction.kind === "refund" && transaction.status === "success") {
        alreadyPayedAmount += transaction.amount;
      }
    });

    let creditNoteData = {
      creditNote: {
        creditNoteNumber: invoiceNumber,
        creditNoteDate: refund.created_at,
        creditNoteType: "CN",
        contact: { id: customer.id, objectName: "Contact" },
        status: paidStatus,
        addressCountry: { id: countryId, objectName: "StaticCountry" },
        contactPerson: { id: sevUserId, objectName: "SevUser" },
        deliveryTerms: "string",
        deliveryDate: refund.created_at,
        taxRate,
        bookingCategory: "UNDERACHIEVEMENT",
        taxText,
        taxType: "custom",
        taxSet,
        currency: "EUR",
        header:
          "Gutschrift Nr. " +
          invoiceNumber +
          " zur Rechnung Nr. " +
          invoice.invoiceNumber,
        mapAll: true,
        objectName: "CreditNote",
        address,
        customerInternalNote: order.id,
        refSrcInvoice: {
          id: invoice.id,
          objectName: "Invoice",
        },
      },

      creditNotePosSave: [],
    };

    let lineItemsPrice = 0;

    refund.refund_line_items.forEach((item) => {
      const { quantity, line_item, subtotal } = item;
      const { price, title } = line_item;

      lineItemsPrice += subtotal;

      // const priceGross = subtotal / quantity;
      // const priceNet = priceGross / (1 + taxRate / 100);
      // const priceTax = priceGross - priceNet;

      const itemTaxRate = line_item.tax_lines?.[0]?.rate
        ? line_item.tax_lines[0].rate * 100
        : 0;

      const priceGross = subtotal / quantity;

      const priceNet =
        itemTaxRate > 0 ? priceGross / (1 + itemTaxRate / 100) : priceGross;

      const priceTax = priceGross - priceNet;
      const creditNotePos = {
        unity: { id: 1, objectName: "Unity" },
        quantity,
        mapAll: "true",
        taxText,
        taxType: "custom",
        taxSet,
        objectName: "CreditNotePos",
        // taxRate,
        // taxRate: itemTaxRate,
        taxRate: title === "Mehrwertsteuer 19%" ? 0 : itemTaxRate,
        priceGross,
        priceTax,
        price: priceNet,
        name: title,
      };

      creditNoteData.creditNotePosSave.push(creditNotePos);
    });

    if (creditNoteData.creditNotePosSave.length === 0) {
      refund.order_adjustments.forEach((item) => {
        let { amount } = item;

        //if amount is negative set it to positive
        if (amount < 0) {
          amount = amount * -1;
        }

        const priceGross = amount;
        const priceNet = priceGross / (1 + taxRate / 100);
        const priceTax = priceGross - priceNet;

        let refundReason = refund.note;

        if (refundReason === "") {
          refundReason = "Rückerstattung";
        }

        const creditNotePos = {
          unity: { id: 1, objectName: "Unity" },
          quantity: 1,
          mapAll: "true",
          taxText,
          taxType: "custom",
          taxSet,
          objectName: "CreditNotePos",
          taxRate,
          priceGross,
          priceTax,
          price: priceNet,
          name: refundReason,
        };

        creditNoteData.creditNotePosSave.push(creditNotePos);
      });
    }

    let paid = false;
    // console.log(alreadyPayedAmount, "alreadyPayedAmount")
    // console.log(lineItemsPrice, "lineItemsPrice")

    if (parseFloat(alreadyPayedAmount) >= parseFloat(lineItemsPrice)) {
      creditNoteData.creditNote.status = "1000";
      paid = true;
    }

    console.log("creditNoteData", creditNoteData);

    //     console.log(
    //   "FINAL CREDIT NOTE JSON",
    //   JSON.stringify(creditNoteData, null, 2)
    // );

    // return {
    //   debug: true,
    //   creditNoteData
    // };

    //   }

    const creditNoteResponse = await this.sevDesk.createCreditNote(
      creditNoteData,
    );

    console.log("creditNoteResponse", creditNoteResponse);

    return {
      id: refund.id,
      paid,
      order_id: order.id,
      amount: alreadyPayedAmount,
      creditnote_id: creditNoteResponse.creditNote.id,
    };
  }

  async updateCreditNoteStatus(refund, creditNote) {
    let alreadyPayedAmount = 0;

    refund.transactions.forEach((transaction) => {
      if (transaction.kind === "refund" && transaction.status === "success") {
        alreadyPayedAmount += transaction.amount;
      }
    });

    if (parseFloat(alreadyPayedAmount) >= creditNote.amount) {
      const updatedCreditNote = await this.bookCreditNote({
        id: creditNote.creditnote_id,
        sumGross: creditNote.amount,
      });
      // console.log(updatedCreditNote, "updatedCreditNote");
      if (updatedCreditNote) {
        return true;
      } else {
        return false;
      }
    } else {
      return false;
    }
  }

  async bookCreditNote(creditNote) {
    try {
      const checkAccountID = await this.sevDesk.getCheckAccountID();

      const bookData = {
        amount: -creditNote.sumGross,
        date: new Date(),
        type: "N",
        checkAccount: {
          id: checkAccountID,
          objectName: "CheckAccount",
        },
      };

      const bookedCreditNote = await this.sevDesk.bookCreditNote(
        creditNote.id,
        bookData,
      );
      return bookedCreditNote;
    } catch (error) {
      console.error(error);
      return null;
    }
  }

  async cancelInvoice(invoice, creditnoteId = 0, order) {
    const invoiceId = invoice.id;
    const contactID = invoice.contact.id;
    try {
      const invoiceData = {
        invoiceId: parseFloat(invoiceId),
      };

      const invoiceRender = await this.sevDesk.renderInvoice(invoiceId);

      const cancelledInvoice = await this.sevDesk.cancelInvoice(
        invoiceId,
        invoiceData,
      );

      if (
        (cancelledInvoice != null &&
          cancelledInvoice.objectName === "CreditNote") ||
        creditnoteId != 0
      ) {
        var getEmail = await this.sevDesk.getEmail(contactID);
        var email = getEmail[0].value;

        const sendCreditNoteViaEmail =
          await this.sevDesk.sendCreditNoteViaEmail(
            cancelledInvoice.id,
            email,
            order.name,
          );

        console.log(sendCreditNoteViaEmail, "sendCreditNoteViaEmail");
        const checkAccountID = await this.sevDesk.getCheckAccountID();

        const bookData = {
          amount: -cancelledInvoice.sumGross,
          date: new Date(),
          type: "N",
          checkAccount: {
            id: checkAccountID,
            objectName: "CheckAccount",
          },
        };

        const bookedCreditNote = await this.sevDesk.bookCreditNote(
          cancelledInvoice.id,
          bookData,
        );
        // console.log(bookedCreditNote, "bookedCreditNote");
      }

      return cancelledInvoice;
    } catch (error) {
      console.error(error);
      return null;
    }
  }
}
export default SevDesk;
