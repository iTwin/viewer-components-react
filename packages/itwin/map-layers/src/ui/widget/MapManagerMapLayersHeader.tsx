/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { ButtonGroup, IconButton } from "@itwin/itwinui-react";
import React from "react";
import { SvgRemove } from "@itwin/itwinui-icons-react";
import { AttachLayerPopupButton } from "./AttachLayerPopupButton";
import "./MapLayerManager.scss";

interface MapManagerLayersHeaderProps {
  label: string;
  detachAllTitle?: string;
  isOverlay: boolean,
  disabled?: boolean;
  disabledDetachAll?: boolean
  onDetachAllClick?: () => Promise<void>
};

export const MapManagerLayersHeader = ({
  label,
  detachAllTitle,
  disabled,
  disabledDetachAll,
  isOverlay,
  onDetachAllClick,
}: MapManagerLayersHeaderProps) => {

  return (
    <div className="map-manager-layers" >
    <span className="map-manager-layers-label">{label}</span>
    <ButtonGroup>
      <AttachLayerPopupButton disabled={disabled} isOverlay={isOverlay} />
      <IconButton disabled={disabled||disabledDetachAll} size="small"
        title={detachAllTitle}
        onClick={onDetachAllClick ? ()=>onDetachAllClick() : undefined}
        styleType="borderless"
      >
        <SvgRemove />
      </IconButton>
    </ButtonGroup>
  </div>
  );

};
