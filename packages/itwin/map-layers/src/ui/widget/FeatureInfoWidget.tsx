/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
import * as React from "react";
import { useActiveFrontstageDef, WidgetState } from "@itwin/appui-react";
import { VirtualizedPropertyGridWithDataProvider } from "@itwin/components-react";
import { FillCentered, Orientation, ResizableContainerObserver } from "@itwin/core-react";
import { MapLayersUI } from "../../mapLayers";
import { FeatureInfoUiItemsProvider } from "../FeatureInfoUiItemsProvider";
import { MapFeatureInfoOptions } from "../Interfaces";
import { FeatureInfoDataProvider } from "./FeatureInfoDataProvider";

export function useSpecificWidgetDef(id: string) {
  const frontstageDef = useActiveFrontstageDef();
  return frontstageDef?.findWidgetDef(id);
}

// MapFeatureInfoWidgetProps
interface MapFeatureInfoWidgetProps {
  featureInfoOpts: MapFeatureInfoOptions;
}

// eslint-disable-next-line @typescript-eslint/naming-convention
export function MapFeatureInfoWidget({ featureInfoOpts }: MapFeatureInfoWidgetProps) {

  const dataProvider = React.useRef<FeatureInfoDataProvider>();
  const [hasData, setHasData] = React.useState<boolean>(false);

  const [noRecordsMessage] = React.useState(MapLayersUI.localization.getLocalizedString("mapLayers:FeatureInfoWidget.NoRecords"));

  const [{ width, height }, setSize] = React.useState({ width: 0, height: 0 });

  const widgetDef = useSpecificWidgetDef(FeatureInfoUiItemsProvider.widgetId);
  const handleDataChanged = React.useCallback(() => {
    const dataAvailable = dataProvider.current !== undefined && dataProvider.current.hasRecords;
    setHasData(dataAvailable);
    if (widgetDef) {
      widgetDef.setWidgetState(dataAvailable ? WidgetState.Open : WidgetState.Hidden);
    }
  }, [widgetDef]);

  React.useEffect(() => {
    dataProvider.current = new FeatureInfoDataProvider();
    return () => {
      dataProvider?.current?.onUnload();
    };
  }, []);

  React.useEffect(() => {
    dataProvider.current?.onDataChanged.addListener(handleDataChanged);
    return () => {
      dataProvider.current?.onDataChanged.removeListener(handleDataChanged);
    };
  }, [handleDataChanged]);

  const handleResize = React.useCallback((w: number, h: number) => {
    setSize({ width: w, height: h });
  }, []);

  if (hasData && dataProvider.current) {
    return (
      <ResizableContainerObserver onResize={handleResize}>
        <VirtualizedPropertyGridWithDataProvider
          width={width}
          height={height}
          dataProvider={dataProvider.current}
          orientation={Orientation.Vertical}
          isPropertySelectionEnabled={featureInfoOpts?.propertyGridOptions?.isPropertySelectionEnabled}
        />
      </ResizableContainerObserver>
    );
  } else {
    return (
      <FillCentered>
        <span>
          <i>{noRecordsMessage}</i>
        </span>
      </FillCentered>
    );
  }
}
