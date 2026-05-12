import React, { useState, useEffect }from 'react';
import {
  useExtensionApi,
  render,
  BlockSpacer,
  Banner,
  Text,
  BlockStack,
  TextBlock,
  Divider,
  Button,
  Checkbox,
  BlockLayout,
  View,
  useShippingAddress,
  useApplyCartLinesChange
} from '@shopify/checkout-ui-extensions-react';

render('Checkout::Dynamic::Render', () => <App />);

function App() {
  const [checked, setChecked] = useState(false);
  const [activated, setActivated] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  const api = useExtensionApi();
  const updateCartLine = useApplyCartLinesChange();
  const lineItems = api.lines.current;


  useEffect(async () => {
    items = api.lines.current;

      let hasMwSt = false;
      for (let i = 0; i < items.length; i++) {

        let hasMwSt = false;
        for (let j = 0; j < items[i].attributes.length; j++) {
          if(items[i].attributes[j].key === 'MwSt.'){
            hasMwSt = true;
          }
        }
      }

      setActivated(hasMwSt);
      setChecked(hasMwSt);
  
  }, []);
  
  const updateItems = async (update) => {

    items = api.lines.current;
    setLoading(true);

    for (let i = 0; i < items.length; i++) {

      let hasMwSt = false;
      for (let j = 0; j < items[i].attributes.length; j++) {
        if(items[i].attributes[j].key === 'MwSt.'){
          hasMwSt = true;
        }
      }
      
      if(update === true && !hasMwSt && (!items[i].merchandise.title.toLowerCase().includes("wall box") || !items[i].merchandise.title.toLowerCase().includes("wallbox"))){

        let newAttributes = items[i].attributes;
        newAttributes.push({key: 'MwSt.', value: 'Nein'});

        //add 
        await updateCartLine({
          type: 'updateCartLine',
          id: items[i].id,
          attributes: newAttributes
        });
      }

      else if(update === false && hasMwSt){
        let newAttributes = items[i].attributes;

        for (let j = 0; j < newAttributes.length; j++) {
          if(newAttributes[j].key === 'MwSt.'){
            newAttributes.splice(j, 1);
          }
        }

        await updateCartLine({
          type: 'updateCartLine',
          id: items[i].id,
          attributes: newAttributes
        });
      }
    }

    setLoading(false);
    return true;
    
  }

  const buttonPressed = async () => {

    let tempItems = api.lines.current;
  
    //log attributes of all items
    // for (let i = 0; i < tempItems.length; i++) {
    //   console.log(tempItems[i].attributes);

    //   //if attributes has key 'MwSt.' also add zapiet_id = 1
    //   if(tempItems[i].attributes.length > 0){
    //     let newAttributes = tempItems[i].attributes;
    //     newAttributes.push({key: 'zapiet_id', value: '1'});
    //     await updateCartLine({
    //       type: 'updateCartLine',
    //       id: tempItems[i].id,
    //       attributes: newAttributes
    //     });
    //   }

    // }

    if(lineItems.length > 0 && checked){
      setError(false);
      await updateItems(true);
      setActivated(true);
    }
    else{
      setError(true);
    }
  };

  const handleCheckbox = async (newValue) => {
console.log("hello****************",newValue)
    setChecked(newValue); 
    if(lineItems.length > 0 && !newValue){
      await updateItems(false);
      setActivated(false);
    }


    
  };

  return (
    <BlockLayout blockAlignment={'center'}  spacing='loose' rows="auto" inlineAlignment={"center"}>
    <Banner status='info' title="Die Mehrwertsteuerbefreiung">
      <Text emphasis='bold'>Auszug aus dem Umsatzsteuergesetz - gemäß §12 Abs. 3 UStG.</Text>
      <BlockStack>
      <TextBlock>
        ,,Die Steuer ermäßigt sich auf 0 Prozent für die folgenden Umsätze:
      </TextBlock>
      <TextBlock size='small'>
        1. die Lieferungen von Solarmodulen an den Betreiber einer Photovoltaikanlage, einschließlich der für den Betrieb einer Photovoltaikanlage wesentlichen Komponenten und der Speicher, die dazu dienen, den mit Solarmodulen erzeugten Strom zu speichern, wenn die Photovoltaikanlage auf oder in der Nähe von Privatwohnungen, Wohnungen sowie öffentlichen und anderen Gebäuden, die für dem Gemeinwohl dienende Tätigkeiten genutzt werden, installiert wird. Die Voraussetzungen des Satzes 1 gelten als erfüllt, wenn die installierte Bruttoleistung der Photovoltaikanlage laut Marktstammdatenregister nicht mehr als 30 Kilowatt (peak) beträgt oder betragen wird;
      </TextBlock>
      <TextBlock size='small'>
      2. den innergemeinschaftlichen Erwerb der in Nummer 1 bezeichneten Gegenstände, die die Voraussetzungen der Nummer 1 erfüllen;
      </TextBlock>
      <TextBlock size='small'>
      3. die Einfuhr der in Nummer 1 bezeichneten Gegenstände, die die Voraussetzungen der Nummer 1 erfüllen;
      </TextBlock>
      <TextBlock size='small'>
      4. die Installation von Photovoltaikanlagen sowie der Speicher, die dazu dienen, den mit Solarmodulen erzeugten Strom zu speichern, wenn die Lieferung der installierten Komponenten die Voraussetzungen der Nummer 1 erfüllt.“
      </TextBlock>
    </BlockStack>
    <BlockSpacer spacing="small200" />
    <Divider></Divider>
    <BlockSpacer spacing="small200" />
    <BlockLayout blockAlignment={'center'} spacing="loose" inlineAlignment={'center'} rows="auto">
      <View >
      <Checkbox
        value= {checked}
        onChange={handleCheckbox}
      >
         <Text size='small' emphasis='bold'>Hiermit bestätige ich, dass ich die Voraussetzungen für eine Mehrwertsteuerbefreiung kenne und diese für diese Bestellung erfüllt sind. Ich bestätige auch, dass die Liefer- und Rechnungsadressen sich in Deutschland befinden.</Text>
        </Checkbox>
      </View>
      {error && 
        <View>
        <Text appearance='critical'>Bitte bestätigen Sie, dass Sie zuerst die Voraussetzungen erfüllen.</Text>
      </View>
      }
      <View>
      <Button loading={loading} loadingLabel={"Laden.."} onPress={buttonPressed} inlineAlignment={'center'} >
        <TextBlock inlineAlignment='center'>Mehrwertsteuerbefreiung auf Warenkorb anwenden</TextBlock>
        </Button>  
      </View>
    </BlockLayout>
    </Banner>
    {!activated &&
        <Banner status='warning' inlineAlignment='center' size='large' >
            Sie haben die Mehrwertsteuerbefreiung für ihren Einkauf nicht aktiviert.
         </Banner>
    }
    {activated &&
        <Banner status='success' inlineAlignment='center' size='large' >
            Sie haben die Mehrwertsteuerbefreiung auf ihren Einkauf angewendet.
         </Banner>
    }
      </BlockLayout>
    
  );
}
