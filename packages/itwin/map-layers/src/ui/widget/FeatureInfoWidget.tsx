/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";

import { VirtualizedPropertyGridWithDataProvider } from "@itwin/components-react";
import { FillCentered, Orientation, ResizableContainerObserver } from "@itwin/core-react";

import { FeatureInfoDataProvider} from "./FeatureInfoDataProvider";
import { MapFeatureInfoOptions } from "../Interfaces";
import { MapLayersUI } from "../../mapLayers";
import { useActiveFrontstageDef, WidgetState } from "@itwin/appui-react";
import { FeatureInfoUiItemsProvider } from "../FeatureInfoUiItemsProvider";

export function useSpecificWidgetDef(id: string) {
  const frontstageDef = useActiveFrontstageDef();
  return frontstageDef?.findWidgetDef(id);
}
interface MapFeatureInfoWidgetProps {
  featureInfoOpts: MapFeatureInfoOptions;
}

// eslint-disable-next-line @typescript-eslint/naming-convention
export function MapFeatureInfoWidget({ featureInfoOpts }: MapFeatureInfoWidgetProps) {

  const dataProvider = React.useRef<FeatureInfoDataProvider>();
  const [hasData, setHasData] = React.useState<boolean>(false);

  const [noRecordsMessage] = React.useState(MapLayersUI.localization.getLocalizedString("mapLayers:FeatureInfoWidget.NoRecords"));

  const [{ width, height }, setSize] = React.useState({ width: 0, height: 0 });

  const handleDataChanged = () => {
    setHasData(dataProvider.current !== undefined && dataProvider.current.hasRecords);
  };

  React.useEffect(() => {
    dataProvider.current = new FeatureInfoDataProvider();
    return () => {
      dataProvider?.current?.onUnload();
    };
  }, []);

  const widgetDef = useSpecificWidgetDef(FeatureInfoUiItemsProvider.widgetId);

  React.useEffect(() => {
    if (hasData) {
      widgetDef?.setWidgetState(WidgetState.Open);
    } else {
      widgetDef?.setWidgetState(WidgetState.Hidden);
    }
  }, [widgetDef, hasData]);

  React.useEffect(() => {

    dataProvider.current?.onDataChanged.addListener(handleDataChanged);
    return () => {
      dataProvider.current?.onDataChanged.removeListener(handleDataChanged);
    };

  }, []);

  const handleResize = React.useCallback((w: number, h: number) => {
    setSize({ width: w, height: h });
  }, []);

  if (!hasData) {
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
