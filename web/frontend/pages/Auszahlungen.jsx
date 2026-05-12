import {
    Card,
    Page,
    Layout,
    TextContainer,
    Image,
    Stack,
    Link,
    Heading,
    Button
  } from "@shopify/polaris";
  import { TitleBar } from "@shopify/app-bridge-react";
  import { useAppQuery, useAuthenticatedFetch } from "../hooks";
  import { trophyImage } from "../assets";
  
  import { ProductsCard } from "../components";
  
  export default function HomePage() {

    const fetch = useAuthenticatedFetch();
    const {
        data,
        refetch: refetchProductCount,
        isLoading: isLoadingCount,
        isRefetching: isRefetchingCount,
    } = useAppQuery({
        url: "/api/payouts",
        reactQueryOptions: {
        onSuccess: () => {
            setIsLoading(false);
        },
        },
    });

    const getShopUrl = async () => {
        //Get the current url
        console.log("getShopUrl", data);
        const url = window.location.href;
        console.log(url);
    };

    const fetchPayouts = async () => {
        const response = await fetch('/admin/api/2023-07/shopify_payments/payouts.json');
        const data = await response.json();
        console.log(data);
    };

    return (
      <Page narrowWidth>
        <TitleBar title="App name" primaryAction={null} />
        <Layout>
          <Layout.Section>
            <Card sectioned>
              <Stack
                wrap={false}
                spacing="extraTight"
                distribution="trailing"
                alignment="center"
              >
                <Stack.Item fill>
                  <TextContainer spacing="loose">
                    <Heading>Auszahlungspage</Heading>
                    
                  </TextContainer>
                  <Button onClick={getShopUrl}>Fetch ddPayouts</Button>
                </Stack.Item>
                
              </Stack>
            </Card>
          </Layout.Section>
          <Layout.Section>
          </Layout.Section>
        </Layout>
      </Page>
    );
  }
  