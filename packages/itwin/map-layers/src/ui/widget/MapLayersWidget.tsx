/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import * as React from "react";
import { useActiveViewport } from "@itwin/appui-react";
import { Flex } from "@itwin/itwinui-react";
import { MapLayersUI } from "../../mapLayers";
import { MapLayerManager } from "./MapLayerManager";

import type { MapLayerOptions } from "../Interfaces";
/**
 * Widget to Manage Map Layers
 * @beta
 */
interface MapLayersWidgetProps {
  mapLayerOptions?: MapLayerOptions;
}
export function MapLayersWidget(props: MapLayersWidgetProps) {
  const [notGeoLocatedMsg] = React.useState(MapLayersUI.localization.getLocalizedString("mapLayers:Messages.NotSupported"));
  const activeViewport = useActiveViewport();
  const ref = React.useRef<HTMLDivElement>(null);
  const [isGeoLocated, setIsGeoLocated] = React.useState(!!activeViewport?.iModel.isGeoLocated);
  React.useEffect(() => {
    const updateIsGeoLocated = () => setIsGeoLocated(!!activeViewport?.iModel.isGeoLocated);
    // call immediately in case the activeViewport changes after its iModel.onEcefLocationChanged has already emitted
    updateIsGeoLocated();
    return activeViewport?.iModel.onEcefLocationChanged.addListener(updateIsGeoLocated);
  }, [activeViewport?.iModel]);

  if (activeViewport && isGeoLocated && activeViewport.view.isSpatialView()) {
    return (
      <div ref={ref} className="map-manager-layer-host">
        <MapLayerManager
          activeViewport={activeViewport}
          mapLayerOptions={props.mapLayerOptions}
          getContainerForClone={() => {
            return ref.current ? ref.current : document.body;
          }}
        />
      </div>
    );
  }

  return (
    <Flex justifyContent="center" style={{ width: "100%", height: "100%" }}>
      <div className="map-manager-not-geo-located-text">{notGeoLocatedMsg}</div>
    </Flex>
  );
}
