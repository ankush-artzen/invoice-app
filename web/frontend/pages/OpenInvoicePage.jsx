import { useState, useEffect } from "react";
import { Card, Page, Layout, TextContainer, Heading } from "@shopify/polaris";
import { TitleBar } from "@shopify/app-bridge-react";

export default function OpenInvoicePage() {
  const [invoiceOpened, setInvoiceOpened] = useState(false);

  useEffect(() => {
    async function openInvoice() {
      try {
        const orderId = new URLSearchParams(window.location.search).get("id");

        const response = await fetch(`/api/getinvoiceid?id=${orderId}`);
        const data = await response.json();
        if (data.url) {
          //read which 

          
          window.open(data.url, "_blank");
          
          setInvoiceOpened(true);
          window.history.back();
        } else {
          console.error("No URL received from the server.");
        }
      } catch (error) {
        console.error("Error fetching invoice URL:", error);
      }
    }

    openInvoice();
  }, []);

  return (
    <Page narrowWidth>
      <TitleBar title="Open Invoice" primaryAction={null} />
      <Layout>
        <Layout.Section>
          <Card sectioned>
            <TextContainer spacing="loose">
              <Heading>
                {invoiceOpened
                  ? "Rechnung in neuem Tab geöffnet. (Popup-Blocker deaktivieren)"
                  : "Lade Rechnung..."}
              </Heading>
            </TextContainer>
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
