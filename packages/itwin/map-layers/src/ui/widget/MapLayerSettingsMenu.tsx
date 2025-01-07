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
}

// eslint-disable-next-line @typescript-eslint/naming-convention
export function MapLayerSettingsMenu({ mapLayerSettings, onMenuItemSelection, activeViewport }: MapLayerSettingsMenuProps) {
  const [labelDetach] = React.useState(MapLayersUI.localization.getLocalizedString("mapLayers:LayerMenu.Detach"));
  const [labelZoomToLayer] = React.useState(MapLayersUI.localization.getLocalizedString("mapLayers:LayerMenu.ZoomToLayer"));
  const [hasRangeData, setHasRangeData] = React.useState<boolean | undefined>();
  const [transparency, setTransparency] = React.useState(mapLayerSettings.transparency);

  React.useEffect(() => {
    async function fetchRangeData() {
      let hasRange = false;
      const indexInDisplayStyle = activeViewport?.displayStyle.findMapLayerIndexByNameAndSource(
        mapLayerSettings.name,
        mapLayerSettings.source,
        mapLayerSettings.isOverlay,
      );
      if (undefined !== indexInDisplayStyle) {
        hasRange = undefined !== (await activeViewport.getMapLayerRange({ index: indexInDisplayStyle, isOverlay: mapLayerSettings.isOverlay }));
      }
      setHasRangeData(hasRange);
    }
    fetchRangeData(); // eslint-disable-line @typescript-eslint/no-floating-promises
  }, [activeViewport, mapLayerSettings]);

  const handleRemoveLayer = React.useCallback(() => {
    onMenuItemSelection("delete", mapLayerSettings);
  }, [onMenuItemSelection, mapLayerSettings]);

  const handleZoomToLayer = React.useCallback(() => {
    onMenuItemSelection("zoom-to-layer", mapLayerSettings);
  }, [onMenuItemSelection, mapLayerSettings]);

  const applyTransparencyChange = React.useCallback(
    (value: number) => {
      if (activeViewport) {
        const newTransparency = value;
        const displayStyle = activeViewport.displayStyle;
        const indexInDisplayStyle = displayStyle.findMapLayerIndexByNameAndSource(mapLayerSettings.name, mapLayerSettings.source, mapLayerSettings.isOverlay);
        if (-1 !== indexInDisplayStyle) {
          const styleTransparency = displayStyle.mapLayerAtIndex({ index: indexInDisplayStyle, isOverlay: mapLayerSettings.isOverlay })?.transparency;
          const styleTransparencyValue = styleTransparency ? styleTransparency : 0;
          if (Math.abs(styleTransparencyValue - newTransparency) > 0.01) {
            // update the display style
            displayStyle.changeMapLayerProps({ transparency: newTransparency }, { index: indexInDisplayStyle, isOverlay: mapLayerSettings.isOverlay });
          }
        }
      }
    },
    [activeViewport, mapLayerSettings],
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
    <MenuItem disabled={!hasRangeData} key={0} onClick={() => handleZoomToLayer()}>
      {labelZoomToLayer}
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
      <DropdownMenu placement="bottom-start" menuItems={dropdownMenuItems}>
        <IconButton size="small" styleType="borderless">
          <SvgMoreVertical />
        </IconButton>
      </DropdownMenu>
    </>
  );
}
