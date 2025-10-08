/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
import "./FeatureInfoWidget.scss";
import * as React from "react";
import { useActiveFrontstageDef, WidgetState } from "@itwin/appui-react";
import { Orientation, VirtualizedPropertyGridWithDataProvider } from "@itwin/components-react";
import { SvgCopy } from "@itwin/itwinui-icons-react";
import { Flex, IconButton } from "@itwin/itwinui-react";
import { MapLayersUI } from "../../mapLayers";
import { FeatureInfoUiItemsProvider } from "../FeatureInfoUiItemsProvider";
import { useResizeObserver } from "../hooks/useResizeObserver";
import { FeatureInfoDataProvider } from "./FeatureInfoDataProvider";

import type { PrimitiveValue } from "@itwin/appui-abstract";
import type { ActionButtonRendererProps } from "@itwin/components-react";
import type { MapFeatureInfoOptions } from "../Interfaces";
export function useSpecificWidgetDef(id: string) {
  const frontstageDef = useActiveFrontstageDef();
  return frontstageDef?.findWidgetDef(id);
}

// MapFeatureInfoWidgetProps
interface MapFeatureInfoWidgetProps {
  featureInfoOpts: MapFeatureInfoOptions;
}

export function MapFeatureInfoWidget({ featureInfoOpts }: MapFeatureInfoWidgetProps) {
  const dataProvider = React.useRef<FeatureInfoDataProvider | null>(null);
  const [hasData, setHasData] = React.useState<boolean>(false);

  const [noRecordsMessage] = React.useState(MapLayersUI.localization.getLocalizedString("mapLayers:FeatureInfoWidget.NoRecords"));

  const [{ width, height }, setSize] = React.useState({ width: 0, height: 0 });

  const widgetDef = useSpecificWidgetDef(FeatureInfoUiItemsProvider.widgetId);
  const handleDataChanged = React.useCallback(() => {
    const dataAvailable = dataProvider.current !== null && dataProvider.current.hasRecords;
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

  const [elementRef] = useResizeObserver<HTMLDivElement>((size) => {
    handleResize(size.width, size.height);
  });

  const copyButton = React.useCallback(
    (props: ActionButtonRendererProps) =>
      props.isPropertyHovered && (
        <div>
          <IconButton
            styleType="borderless"
            label="Copy"
            onClick={() => {
              const value = props.property.value;
              if (value !== undefined && value.hasOwnProperty("displayValue")) {
                navigator.clipboard.writeText((value as PrimitiveValue).displayValue ?? "").catch((_) => {});
              }
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
      <div ref={elementRef} className="feature-info-widget-container">
        <VirtualizedPropertyGridWithDataProvider
          width={width}
          height={height}
          dataProvider={dataProvider.current}
          orientation={Orientation.Vertical}
          isPropertySelectionEnabled={featureInfoOpts?.propertyGridOptions?.isPropertySelectionEnabled}
          isPropertyHoverEnabled // This need to be turned on to have the action button appears only when property hovered
          actionButtonRenderers={[copyButton]}
        />
      </div>
    );
  } else {
    return (
      <Flex justifyContent="center" className="feature-info-widget-no-records">
        <span>
          <i>{noRecordsMessage}</i>
        </span>
      </Flex>
    );
  }
}
