/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
import * as React from "react";
import type { PrimitiveValue } from "@itwin/appui-abstract";
import { useActiveFrontstageDef, WidgetState } from "@itwin/appui-react";
import type { ActionButtonRendererProps } from "@itwin/components-react";
import { VirtualizedPropertyGridWithDataProvider } from "@itwin/components-react";
import { FillCentered, Orientation, ResizableContainerObserver } from "@itwin/core-react";
import { SvgCopy } from "@itwin/itwinui-icons-react";
import { IconButton } from "@itwin/itwinui-react";
import { MapLayersUI } from "../../mapLayers";
import { FeatureInfoUiItemsProvider } from "../FeatureInfoUiItemsProvider";
import type { MapFeatureInfoOptions } from "../Interfaces";
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

  const copyButton = React.useCallback(
    (props: ActionButtonRendererProps) =>
      props.isPropertyHovered && (
        <div>
          <IconButton
            styleType="borderless"
            onClick={() => {
              const value = props.property.value;
              if (value !== undefined && value.hasOwnProperty("displayValue"))
                {navigator.clipboard.writeText((value as PrimitiveValue).displayValue ?? "").catch((_) => {});}
            }}
          >
            <SvgCopy />
          </IconButton>
        </div>
      ),
    [],
  );

  if (hasData && dataProvider.current) {
    return (
      <ResizableContainerObserver onResize={handleResize}>
        <VirtualizedPropertyGridWithDataProvider
          width={width}
          height={height}
          dataProvider={dataProvider.current}
          orientation={Orientation.Vertical}
          isPropertySelectionEnabled={featureInfoOpts?.propertyGridOptions?.isPropertySelectionEnabled}
          isPropertyHoverEnabled // This need to be turned on to have the action button appears only when property hovered
          actionButtonRenderers={[copyButton]}
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
