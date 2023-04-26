/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";

import { VirtualizedPropertyGridWithDataProvider } from "@itwin/components-react";
import { FillCentered, Orientation, ResizableContainerObserver } from "@itwin/core-react";

import { FeatureInfoDataProvider, MapFeatureInfoDataUpdate, MapFeatureInfoLoadState } from "./FeatureInfoDataProvider";
import { ProgressRadial } from "@itwin/itwinui-react";
import { MapFeatureInfoOptions } from "../Interfaces";
import { MapLayersUI } from "../../mapLayers";

interface MapFeatureInfoWidgetProps {
  featureInfoOpts: MapFeatureInfoOptions;
}

// eslint-disable-next-line @typescript-eslint/naming-convention
export function MapFeatureInfoWidget({ featureInfoOpts }: MapFeatureInfoWidgetProps) {

  const dataProvider = React.useRef<FeatureInfoDataProvider>();
  const [loadingData, setLoadingData] = React.useState<boolean>(false);
  const [hasData, setHasData] = React.useState<boolean>(false);
  const [noRecordsMessage] = React.useState(MapLayersUI.localization.getLocalizedString("mapLayers:FeatureInfoWidget.NoRecords"));

  const [{ width, height }, setSize] = React.useState({ width: 0, height: 0 });

  const handleLoadStateChange = (state: MapFeatureInfoLoadState) => {
    setLoadingData(state === MapFeatureInfoLoadState.DataLoadStart);
  };
  const handleDataUpdated = (state: MapFeatureInfoDataUpdate) => {
    setHasData(state.recordCount !== 0);
  };

  React.useEffect(() => {
    if (featureInfoOpts?.onMapHit) {
      dataProvider.current = new FeatureInfoDataProvider(featureInfoOpts.onMapHit);
    }
    return () => {
      dataProvider?.current?.onUnload();
    };
  }, [featureInfoOpts?.onMapHit]);

  React.useEffect(() => {

    dataProvider.current?.onDataUpdated.addListener(handleDataUpdated);
    return () => {
      dataProvider.current?.onDataUpdated.removeListener(handleDataUpdated);
    };

  }, []);

  React.useEffect(() => {
    if (featureInfoOpts?.showLoadProgressAnimation) {
      dataProvider.current?.onDataLoadStateChanged.addListener(handleLoadStateChange);
      return () => {
        dataProvider.current?.onDataLoadStateChanged.removeListener(handleLoadStateChange);
      };
    }
    return;

  }, [featureInfoOpts?.showLoadProgressAnimation]);

  const handleResize = React.useCallback((w: number, h: number) => {
    setSize({ width: w, height: h });
  }, []);

  if (loadingData) {
    return (<FillCentered><ProgressRadial indeterminate={true}></ProgressRadial></FillCentered>);
  } else if (!hasData) {
    return (<FillCentered><span><i>{noRecordsMessage}</i></span></FillCentered>);
  } else {
    if (dataProvider.current)
      return (
        <ResizableContainerObserver onResize={handleResize}>
          <VirtualizedPropertyGridWithDataProvider
            width={width}
            height={height}
            dataProvider={dataProvider.current}
            orientation={Orientation.Vertical}
            isPropertySelectionEnabled={featureInfoOpts?.propertyGridOptions?.isPropertySelectionEnabled} />
        </ResizableContainerObserver>
      );
    else
      return (<></>);
  }
}
