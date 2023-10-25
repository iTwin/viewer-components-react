/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import * as React from "react";
import { useActiveViewport } from "@itwin/appui-react";
import { FillCentered } from "@itwin/core-react";
import { MapLayerOptions } from "../Interfaces";
import { MapLayerManager } from "./MapLayerManager";
import { MapLayersUI } from "../../mapLayers";
import { Tabs } from "@itwin/itwinui-react";

/**
 * Widget to Manage Map Layers
 * @beta
 */
interface MapLayersWidgetProps {
  mapLayerOptions?: MapLayerOptions;
}
// eslint-disable-next-line @typescript-eslint/naming-convention
export function MapLayersWidget(_props: MapLayersWidgetProps) {
  const [notGeoLocatedMsg] = React.useState(MapLayersUI.localization.getLocalizedString("mapLayers:Messages.NotSupported"));
  const activeViewport = useActiveViewport();
  const ref = React.useRef<HTMLDivElement>(null);
  const [isGeoLocated, setIsGeoLocated] = React.useState(!!activeViewport?.iModel.isGeoLocated);

  React.useEffect(() => {
    const updateIsGeoLocated = () => setIsGeoLocated(!!activeViewport?.iModel.isGeoLocated);
    return activeViewport?.iModel.onEcefLocationChanged.addListener(updateIsGeoLocated);
  }, [activeViewport?.iModel]);

  // if (activeViewport && isGeoLocated && activeViewport.view.isSpatialView())
  //   return (
  //     <div ref={ref} className="map-manager-layer-host">
  //       <MapLayerManager activeViewport={activeViewport} mapLayerOptions={props.mapLayerOptions} getContainerForClone={() => {
  //         return ref.current ? ref.current : document.body;
  //       }} />
  //     </div>
  //   );

  return (
    <Tabs.Wrapper>
      <Tabs.TabList>
        <Tabs.Tab label='Apple' value='apple' />
        <Tabs.Tab label='Orange' value='orange' />
        <Tabs.Tab label='Grape' value='grape' />
      </Tabs.TabList>

      <Tabs.Panel value='apple'>
      An apple is a round, edible fruit produced by an apple tree (Malus
      domestica). Apple trees are cultivated worldwide and are the most widely
      grown species in the genus Malus. The tree originated in Central Asia,
      where its wild ancestor, Malus sieversii, is still found. Apples have
      been grown for thousands of years in Asia and Europe and were introduced
      to North America by European colonists. Apples have religious and
      mythological significance in many cultures, including Norse, Greek, and
      European Christian tradition.
      </Tabs.Panel>
      <Tabs.Panel value='orange'>
      An orange is a fruit of various citrus species in the family Rutaceae
      (see list of plants known as orange); it primarily refers to Citrus x
      sinensis, which is also called sweet orange, to distinguish it from the
      related Citrus x aurantium, referred to as bitter orange. The sweet
      orange reproduces asexually (apomixis through nucellar embryony);
      varieties of the sweet orange arise through mutations.
      </Tabs.Panel>
      <Tabs.Panel value='grape'>
      A grape is a fruit, botanically a berry, of the deciduous woody vines of
      the flowering plant genus Vitis. Grapes are a non-climacteric type of
      fruit, generally occurring in clusters. The cultivation of grapes began
      perhaps 8,000 years ago, and the fruit has been used as human food over
      history. Eaten fresh or in dried form (as raisins, currants and
      sultanas), grapes also hold cultural significance in many parts of the
      world, particularly for their role in winemaking. Other grape-derived
      products include various types of jam, juice, vinegar and oil.
      </Tabs.Panel>
    </Tabs.Wrapper>
  );
}
