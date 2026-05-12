import { useState } from "react";
import {
  Card,
  Page,
  Layout,
  TextField,
  Button,
  Form,
  FormLayout,
} from "@shopify/polaris";
import { TitleBar } from "@shopify/app-bridge-react";

export default function SevDesk() {
  const [apiKey, setApiKey] = useState("");
  const [headerText, setHeaderText] = useState("");
  const [footerText, setFooterText] = useState("");

  const handleSave = async () => {
    try {
      const response = await fetch("/api/save_settings", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          apiKey,
          headerText,
          footerText,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to save settings");
      }

      console.log("Settings saved successfully");
    } catch (error) {
      console.error("Error saving settings:", error);
    }
  };

  return (
    <Page>
      <TitleBar title="Settings" />
      <Layout>
        <Layout.Section>
          <Card sectioned>
            <Form onSubmit={handleSave}>
              <FormLayout>
                <TextField
                  label="API Key"
                  value={apiKey}
                  onChange={setApiKey}
                />
                <TextField
                  label="Header Text"
                  value={headerText}
                  onChange={setHeaderText}
                  multiline
                />
                <TextField
                  label="Footer Text"
                  value={footerText}
                  onChange={setFooterText}
                  multiline
                />
                <Button submit primary>
                  Save
                </Button>
              </FormLayout>
            </Form>
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
