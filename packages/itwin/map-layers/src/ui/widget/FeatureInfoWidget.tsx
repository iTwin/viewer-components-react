/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
import "./FeatureInfoWidget.scss";
import * as React from "react";
import { useActiveFrontstageDef, WidgetState } from "@itwin/appui-react";
import { Orientation, VirtualizedPropertyGridWithDataProvider } from "@itwin/components-react";

import { useResizeObserver } from "../hooks/useResizeObserver";
import { CopyActionButton } from "./CopyActionButton";
import { FeatureInfoDataProvider } from "./FeatureInfoDataProvider";

import type { PrimitiveValue } from "@itwin/appui-abstract";
import type { ActionButtonRendererProps } from "@itwin/components-react";

function useSpecificWidgetDef(id: string) {
  const frontstageDef = useActiveFrontstageDef();
  return frontstageDef?.findWidgetDef(id);
}

/**
 * Props for {@link MapFeatureInfoWidget}.
 */
interface MapFeatureInfoWidgetProps {
  /** The widget that will be shown/hidden based on feature info data availability. */
  widgetId: string;
  /** Enables property selection support in the property grid when set. */
  isPropertySelectionEnabled?: boolean;
  /** Invoked when feature info data availability changes. */
  onDataChanged?: (hasData: boolean) => void;
  /**
   * Optional copy handler used by the copy action button.
   * When omitted, the component copies values using the browser clipboard API.
   */
  onCopy?: (value: string) => Promise<void> | void;
}

/**
 * Displays map feature info in a virtualized property grid and keeps the
 * owning widget open/hidden based on whether records are available.
 *
 * @param props - Widget configuration and callbacks.
 * @returns The feature info property grid UI, or `null` when no records are available.
 */
export function MapFeatureInfoWidget({ widgetId, isPropertySelectionEnabled, onDataChanged, onCopy }: MapFeatureInfoWidgetProps) {
  const dataProvider = React.useRef<FeatureInfoDataProvider | null>(null);
  const [hasData, setHasData] = React.useState(false);

  const [{ width, height }, setSize] = React.useState({ width: 0, height: 0 });

  const widgetDef = useSpecificWidgetDef(widgetId);
  const handleDataChanged = React.useCallback(() => {
    const dataAvailable = dataProvider.current !== null && dataProvider.current.hasRecords;
    setHasData(dataAvailable);
    if (widgetDef) {
      widgetDef.setWidgetState(dataAvailable ? WidgetState.Open : WidgetState.Hidden);
    }
    onDataChanged?.(dataAvailable);
  }, [widgetDef, onDataChanged]);

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
          <CopyActionButton value={props.property.value ? (props.property.value as PrimitiveValue).displayValue ?? "" : ""} onCopy={onCopy} />
        </div>
      ),
    [onCopy],
  );

  if (hasData && dataProvider.current) {
    return (
      <div ref={elementRef} className="feature-info-widget-container">
        <VirtualizedPropertyGridWithDataProvider
          width={width}
          height={height}
          dataProvider={dataProvider.current}
          orientation={Orientation.Vertical}
          isPropertySelectionEnabled={isPropertySelectionEnabled}
          isPropertyHoverEnabled // This need to be turned on to have the action button appears only when property hovered
          actionButtonRenderers={[copyButton]}
        />
      </div>
    );
  } else {
    return null;
  }
}
