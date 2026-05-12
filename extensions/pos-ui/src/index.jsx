import React from 'react';
import {Tile, Text, Screen, render, useExtensionApi} from '@shopify/retail-ui-extensions-react';

const SmartGridTile = () => {
  const api = useExtensionApi();
  return (
    <Tile
      title="Lieferscheinerstellen"
      subtitle="SmartGrid Extension"
      onPress={() => {
        api.smartGrid.presentModal({path: 'default'});
      }}
      enabled
    />
  );
};

const SmartGridModal = () => {
  return (
    <Screen name="LieferscheinTest">
      <Text>Lieferschein test</Text>
    </Screen>
  );
}

render('Retail::SmartGrid::Tile', () => <SmartGridTile />);
render('Retail::SmartGrid::Modal', () => <SmartGridModal />);