/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { ButtonGroup, IconButton } from "@itwin/itwinui-react";
import React from "react";
import { SvgVisibilityHalf, SvgVisibilityHide, SvgVisibilityShow } from "@itwin/itwinui-icons-react";
import { MapLayersUI } from "../../mapLayers";


interface MapLayerVisibilityActionsProps {
  disabled: boolean;
  showAll: () => Promise<void>;
  hideAll: () => Promise<void>;
  invert: () => Promise<void>;

}

export const MapLayerVisibilityAction = ({
  disabled,
  showAll,
  hideAll,
  invert,
}: MapLayerVisibilityActionsProps) => {

  const [showAllLabel] = React.useState(MapLayersUI.localization.getLocalizedString("mapLayers:MapLayerVisibilityActions.ShowAllLabel"));
  const [hideAllLabel] = React.useState(MapLayersUI.localization.getLocalizedString("mapLayers:MapLayerVisibilityActions.HideAllLabel"));
  const [invertAllLabel] = React.useState(MapLayersUI.localization.getLocalizedString("mapLayers:MapLayerVisibilityActions.InvertAllLabel"));
  return (
    <div>
      <ButtonGroup>
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
            title={hideAllLabel}
            size="small"
            styleType="borderless"
            onClick={invert}
          >
            <SvgVisibilityHalf />
          </IconButton>
          <IconButton
            disabled={disabled}
            title={invertAllLabel}
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

