import { BlockLayout } from '@shopify/checkout-ui-extensions-react';
import {
  Banner,
  useApi,
  useTranslate,
  useAttributeValues,
  reactExtension,
} from '@shopify/ui-extensions-react/checkout';
import { useEffect, useState } from 'react';

export default reactExtension(
  'purchase.checkout.block.render',
  () => <Extension />,
);


function Extension() {
  const translate = useTranslate();

  const [isPickup, setPickup] = useState(false);
  const [checkoutMethod] =
  useAttributeValues([
    'Checkout-Method'
  ]);


  useEffect(async () => {
      if(checkoutMethod){
        console.log("checkoutMethod", checkoutMethod);
      }
        if(checkoutMethod === 'pickup'){
          setPickup(true);
        }
        



  
  }, []);
  

  return (
    <BlockLayout>
      {isPickup &&
        <Banner title="Achtung" status='warning'>
          Bei Abholungen unbedingt die richtige Rechnungsadresse angeben! Die Lieferadresse wird automatisch auf die Addresse unseres Lagers gesetzt.
        </Banner>
      }
    </BlockLayout>
  );
}