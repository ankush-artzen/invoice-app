import {
  reactExtension,
  BlockStack,
  useApi,
  Button,
  AdminAction,
  Text,
  Link,
} from "@shopify/ui-extensions-react/admin";
import { useState, useEffect } from "react";

const TARGET = "admin.order-details.action.render";
export default reactExtension(TARGET, () => {
  return <InvoiceRedirectButton />;
});

function InvoiceRedirectButton() {
  const [invoiceUrl, setInvoiceUrl] = useState("");
  const [invoiceOpened, setInvoiceOpened] = useState(false);
  const appUrl =
    "https://isolarpro-app.herokuapp.com";
  const { i18n, close, data } = useApi(TARGET);
  console.log({ data });
  const orderId = data.selected[0].id; // You get Shopify's orderGid like: gid://shopify/Order/1234567890
  const orderNumber = orderId.split("/").pop();
  console.log(orderNumber, "orderNumber");

  useEffect(() => {
    async function openInvoice() {
      try {
        // Fetch the invoice URL from the server using the order number
        const response = await fetch(
          `${appUrl}/api/getinvoiceid?id=${orderNumber}`
        );
        const data = await response.json();
        setInvoiceOpened(true);
        if (data.url) {
          //read which
          setInvoiceUrl(data.url);
        } else {
          console.error("No URL received from the server.");
        }
      } catch (error) {
        console.error("Error fetching invoice URL:", error);
      }
    }

    openInvoice();
  }, [orderNumber]);

  return (
    <AdminAction
      secondaryAction={
        <Button
          onPress={() => {
            console.log("closing");
            close();
          }}
        >
          Close
        </Button>
      }
    >
      <BlockStack>
        <Text fontWeight="bold">
          {/* {i18n.translate("Welcome", { target: TARGET })} */}
          Check the invoice for your order here
          {/* Überprüfen Sie hier die Rechnung zur Bestellung */}
        </Text>

        {invoiceUrl ? (
          <>
            <Link href={invoiceUrl}>Open invoice in Sevdesk</Link>
            {/* <Link href={invoiceUrl}>Rechnung in Sevdesk öffnen</Link> */}
          </>
        ) : (
          <Text>
            {" "}
            {/* {invoiceOpened
              ? "Keine URL vom Sevdesk-Server empfangen."
              : "Lade Rechnung..."} */}
            {invoiceOpened
              ? "No URL received from Sevdesk server."
              : "Loading..."}
          </Text>
        )}
      </BlockStack>
    </AdminAction>
  );
}
