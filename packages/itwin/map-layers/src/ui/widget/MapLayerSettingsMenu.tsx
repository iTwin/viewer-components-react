/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
import "./MapLayerManager.scss";
import * as React from "react";
import { SvgMoreVertical } from "@itwin/itwinui-icons-react";
import { DropdownMenu, IconButton, MenuItem, Slider } from "@itwin/itwinui-react";
import { MapLayersUI } from "../../mapLayers";

import type { ScreenViewport } from "@itwin/core-frontend";
import type { StyleMapLayerSettings } from "../Interfaces";
interface MapLayerSettingsMenuProps {
  mapLayerSettings: StyleMapLayerSettings;
  onMenuItemSelection: (action: string, mapLayerSettings: StyleMapLayerSettings) => void;
  activeViewport: ScreenViewport;
  disabled?: boolean;
}

export function MapLayerSettingsMenu({ mapLayerSettings, onMenuItemSelection, activeViewport, disabled }: MapLayerSettingsMenuProps) {
  const [labelDetach] = React.useState(MapLayersUI.localization.getLocalizedString("mapLayers:LayerMenu.Detach"));
  const [labelZoomToLayer] = React.useState(MapLayersUI.localization.getLocalizedString("mapLayers:LayerMenu.ZoomToLayer"));
  const [labelLoading] = React.useState(MapLayersUI.localization.getLocalizedString("mapLayers:LayerMenu.Loading") || "Loading...");
  const [hasRangeData, setHasRangeData] = React.useState<boolean | undefined>();
  const [isLoadingRangeData, setIsLoadingRangeData] = React.useState(false);
  const [transparency, setTransparency] = React.useState(mapLayerSettings.transparency);

  React.useEffect(() => {
    let isMounted = true;
    let retryTimeout: NodeJS.Timeout;

    async function fetchRangeDataWithRetry(attempt: number = 1, maxAttempts: number = 3) {
      if (!isMounted) return;

      setIsLoadingRangeData(true);
      let hasRange = false;

      // Use the specific layer index from mapLayerSettings instead of searching by name/source
      // This ensures duplicate layers use their own index rather than the first match
      if (undefined !== mapLayerSettings.layerIndex && activeViewport) {
        try {
          // Add a delay for layer to initialize, especially important for WMS layers
          if (attempt === 1) {
            await new Promise(resolve => setTimeout(resolve, 200));
          }

          const rangeResult = await activeViewport.getMapLayerRange({
            index: mapLayerSettings.layerIndex,
            isOverlay: mapLayerSettings.isOverlay
          });
          hasRange = undefined !== rangeResult;

          // If no range data found and we have retries left, try again after a delay
          if (!hasRange && attempt < maxAttempts) {
            retryTimeout = setTimeout(() => {
              if (isMounted) {
                fetchRangeDataWithRetry(attempt + 1, maxAttempts); // eslint-disable-line @typescript-eslint/no-floating-promises
              }
            }, attempt * 300); // Increasing delay: 300ms, 600ms
            return;
          }
        } catch {
          // If error occurs and we have retries left, try again
          if (attempt < maxAttempts) {
            retryTimeout = setTimeout(() => {
              if (isMounted) {
                fetchRangeDataWithRetry(attempt + 1, maxAttempts); // eslint-disable-line @typescript-eslint/no-floating-promises
              }
            }, attempt * 300);
            return;
          }
        }
      }

      if (isMounted) {
        setHasRangeData(hasRange);
        setIsLoadingRangeData(false);
      }
    }

    fetchRangeDataWithRetry(); // eslint-disable-line @typescript-eslint/no-floating-promises

    return () => {
      isMounted = false;
      if (retryTimeout) {
        clearTimeout(retryTimeout);
      }
    };
  }, [activeViewport, mapLayerSettings.layerIndex, mapLayerSettings.isOverlay]);

  const handleRemoveLayer = React.useCallback(() => {
    onMenuItemSelection("delete", mapLayerSettings);
  }, [onMenuItemSelection, mapLayerSettings]);

  const handleZoomToLayer = React.useCallback(() => {
    onMenuItemSelection("zoom-to-layer", mapLayerSettings);
  }, [onMenuItemSelection, mapLayerSettings]);

  const applyTransparencyChange = React.useCallback(
    (value: number) => {
      if (activeViewport && undefined !== mapLayerSettings.layerIndex) {
        const newTransparency = value;
        const displayStyle = activeViewport.displayStyle;
        const indexInDisplayStyle = mapLayerSettings.layerIndex;
        const styleTransparency = displayStyle.mapLayerAtIndex({ index: indexInDisplayStyle, isOverlay: mapLayerSettings.isOverlay })?.transparency;
        const styleTransparencyValue = styleTransparency ? styleTransparency : 0;
        if (Math.abs(styleTransparencyValue - newTransparency) > 0.01) {
          // update the display style
          displayStyle.changeMapLayerProps({ transparency: newTransparency }, { index: indexInDisplayStyle, isOverlay: mapLayerSettings.isOverlay });
        }
      }
    },
    [activeViewport, mapLayerSettings.layerIndex, mapLayerSettings.isOverlay],
  );

  const handleTransparencyChange = React.useCallback(
    (values: readonly number[]) => {
      if (values.length) {
        const newTransparency = values[0] / 100.0;
        if (newTransparency !== transparency) {
          setTransparency(newTransparency);
          applyTransparencyChange(newTransparency);
        }
      }
    },
    [transparency, applyTransparencyChange],
  );

  const dropdownMenuItems = () => [
    <MenuItem
      disabled={hasRangeData === false || isLoadingRangeData}
      key={0}
      onClick={() => handleZoomToLayer()}
    >
      {isLoadingRangeData ? labelLoading : labelZoomToLayer}
    </MenuItem>,
    <MenuItem key={1} onClick={() => handleRemoveLayer()}>
      {labelDetach}
    </MenuItem>,
    <MenuItem key={2}>
      <Slider className="map-manager-item-dropdown-slider" min={0} max={100} values={[transparency * 100]} step={1} onChange={handleTransparencyChange} />
    </MenuItem>,
  ];

  return (
    <>
      <DropdownMenu as="div" placement="bottom-start" menuItems={dropdownMenuItems} aria-disabled={disabled}>
        <IconButton size="small" styleType="borderless">
          <SvgMoreVertical />
        </IconButton>
      </DropdownMenu>
    </>
  );
}
