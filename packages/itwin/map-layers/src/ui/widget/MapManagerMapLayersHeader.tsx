/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { ButtonGroup, IconButton } from "@itwin/itwinui-react";
import * as React from "react";
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

export function MapManagerLayersHeader (props: MapManagerLayersHeaderProps)
{
const onDetachAllClick = props.onDetachAllClick;
return (
  <div className="map-manager-layers">
    <span className="map-manager-layers-label">{props.label}</span>
    <ButtonGroup>
      <AttachLayerPopupButton disabled={props.disabled} isOverlay={props.isOverlay} />
      <IconButton disabled={props.disabled||props.disabledDetachAll} size="small"
        title={props.detachAllTitle}
        onClick={onDetachAllClick ? ()=>onDetachAllClick() : undefined}
        styleType="borderless"
      >
        <SvgRemove />
      </IconButton>
    </ButtonGroup>
  </div>
);
}
