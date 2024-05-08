/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
import * as React from "react";
import { PrimitiveValue, PropertyRecord } from "@itwin/appui-abstract";
import { useActiveFrontstageDef, WidgetState } from "@itwin/appui-react";
import { VirtualizedPropertyGridWithDataProvider } from "@itwin/components-react";
import { ContextMenuItem, FillCentered, GlobalContextMenu, Orientation, ResizableContainerObserver } from "@itwin/core-react";
import { SvgCopy } from "@itwin/itwinui-icons-react";
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

interface ContextMenuInfo {
  clientX: number;
  clientY: number;
  propertyRecord: PropertyRecord;
}

// eslint-disable-next-line @typescript-eslint/naming-convention
export function MapFeatureInfoWidget({ featureInfoOpts }: MapFeatureInfoWidgetProps) {

  const dataProvider = React.useRef<FeatureInfoDataProvider>();
  const [hasData, setHasData] = React.useState<boolean>(false);

  const [noRecordsMessage] = React.useState(MapLayersUI.localization.getLocalizedString("mapLayers:FeatureInfoWidget.NoRecords"));

  const [{ width, height }, setSize] = React.useState({ width: 0, height: 0 });

  const [contextMenuInfo, setContextMenuInfo] = React.useState<ContextMenuInfo | undefined>();
  const closeContextMenu = () => setContextMenuInfo(undefined);

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
      <>
        <ResizableContainerObserver onResize={handleResize}>
          <VirtualizedPropertyGridWithDataProvider
            width={width}
            height={height}
            dataProvider={dataProvider.current}
            orientation={Orientation.Vertical}
            isPropertySelectionEnabled={featureInfoOpts?.propertyGridOptions?.isPropertySelectionEnabled}
            onPropertyContextMenu={(args) => setContextMenuInfo({
              propertyRecord: args.propertyRecord,
              clientX: args.event.clientX,
              clientY: args.event.clientY})}

          />
        </ResizableContainerObserver>
        <GlobalContextMenu
          opened={!!contextMenuInfo}
          onOutsideClick={closeContextMenu}
          onSelect={closeContextMenu}
          x={contextMenuInfo?.clientX ?? 0}
          y={contextMenuInfo?.clientY ?? 0}
        >
          <ContextMenuItem
            icon={<SvgCopy />}
            onSelect={()=>{
              const value = contextMenuInfo?.propertyRecord.value;
              if (value !== undefined && value.hasOwnProperty("displayValue") )
                navigator.clipboard.writeText((value as PrimitiveValue).displayValue??"").catch((_) => { });
            }}
            label="Copy Text">Copy Text
          </ContextMenuItem>
        </GlobalContextMenu>
      </>
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
