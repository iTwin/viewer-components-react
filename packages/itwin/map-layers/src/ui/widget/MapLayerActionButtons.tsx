/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { ButtonGroup, Checkbox, IconButton } from "@itwin/itwinui-react";
import * as React from "react";
import { SvgUnlink, SvgVisibilityHalf, SvgVisibilityHide, SvgVisibilityShow } from "@itwin/itwinui-icons-react";
import { MapLayersUI } from "../../mapLayers";

interface MapLayerActionButtonsProps {
  disabled: boolean;
  checked: boolean;
  disabledUnlink?: boolean;
  showAll: () => Promise<void>;
  hideAll: () => Promise<void>;
  invert: () => Promise<void>;
  selectAll: () => Promise<void>;
  unlink: () => Promise<void>;

}

export const MapLayerActionButtons = ({
  disabled,
  showAll,
  hideAll,
  invert,
  selectAll,
  unlink,
  checked,
  disabledUnlink,
}: MapLayerActionButtonsProps) => {

  const [showAllLabel] = React.useState(MapLayersUI.localization.getLocalizedString("mapLayers:MapLayerActionButtons.ShowAllLabel"));
  const [hideAllLabel] = React.useState(MapLayersUI.localization.getLocalizedString("mapLayers:MapLayerActionButtons.HideAllLabel"));
  const [invertAllLabel] = React.useState(MapLayersUI.localization.getLocalizedString("mapLayers:MapLayerActionButtons.InvertAllLabel"));
  const [detachSelectedLabel] = React.useState(MapLayersUI.localization.getLocalizedString("mapLayers:MapLayerActionButtons.DetachSelectedLabel"));
  return (
    <div className= "map-manager-layer-action-buttons">
      <Checkbox data-testid={"select-all-checkbox"} checked={checked} onChange={selectAll} className="map-manager-layer-action-unlink-button" ></Checkbox>
      <ButtonGroup>
        <IconButton
          disabled={disabled || disabledUnlink}
          title={detachSelectedLabel}
          size="small"
          styleType="borderless"
          onClick={unlink}
        >
          <SvgUnlink />
        </IconButton>
      </ButtonGroup>
      <ButtonGroup className="map-manager-layer-action-buttons-inside-separator">
        <IconButton
          disabled={disabled}
          size="small"
          title={showAllLabel}
          onClick={showAll}
          styleType="borderless"
        >
          <SvgVisibilityShow />
        </IconButton>
        <IconButton
          disabled={disabled}
          title={invertAllLabel}
          size="small"
          styleType="borderless"
          onClick={invert}
        >
          <SvgVisibilityHalf />
        </IconButton>
        <IconButton
          disabled={disabled}
          title={hideAllLabel}
          size="small"
          styleType="borderless"
          onClick={hideAll}
        >
          <SvgVisibilityHide />
        </IconButton>

      </ButtonGroup>
    </div>
  );

};

