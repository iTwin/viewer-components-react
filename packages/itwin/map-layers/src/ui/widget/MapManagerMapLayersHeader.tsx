/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
import { ButtonGroup } from "@itwin/itwinui-react";
import { AttachLayerPopupButton } from "./AttachLayerPopupButton";
import "./MapLayerManager.scss";

interface MapManagerLayersHeaderProps {
  label: string;
  isOverlay: boolean;
  disabled?: boolean;
}

export function MapManagerLayersHeader(props: MapManagerLayersHeaderProps) {
  return (
    <div className="map-manager-layers">
      <span className="map-manager-layers-label">{props.label}</span>
      <ButtonGroup>
        <AttachLayerPopupButton disabled={props.disabled} isOverlay={props.isOverlay} />
      </ButtonGroup>
    </div>
  );
}
