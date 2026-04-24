/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import React from "react";
import { MapLayerActionButtons } from "./MapLayerActionButtons";
import { MapLayerDroppable } from "./MapLayerDroppable";

import type { ScreenViewport } from "@itwin/core-frontend";
import type { MapLayerOptions, StyleMapLayerSettings } from "../Interfaces";
import { AttachLayerPopupButton } from "./AttachLayerPopupButton";

/** @internal */
interface MapLayersListProps {
  activeViewport: ScreenViewport;
  backgroundMapVisible: boolean;
  isOverlay: boolean;
  label: string;
  layersList: StyleMapLayerSettings[];
  mapLayerOptions?: MapLayerOptions;
  onItemEdited: () => void;
  onItemSelected: (isOverlay: boolean, index: number) => void;
  onItemVisibilityToggleClicked: (mapLayerSettings: StyleMapLayerSettings) => void;
  onMenuItemSelected: (action: string, mapLayerSettings: StyleMapLayerSettings) => void;
}

/** @internal */
export function MapLayersList(props: MapLayersListProps) {
  return (
    <div className="map-manager-layer-wrapper" data-testid="map-manager-layer-section">
      <div className="map-manager-layers">
        <span className="map-manager-layers-label">{props.label}</span>
        <AttachLayerPopupButton disabled={!props.backgroundMapVisible} isOverlay={props.isOverlay} />
      </div>
      {props.layersList.length > 0 && (
        <MapLayerActionButtons
          disabled={!props.backgroundMapVisible}
          isOverlay={props.isOverlay}
          layersList={props.layersList}
          activeViewport={props.activeViewport}
        />
      )}
      <MapLayerDroppable
        disabled={!props.backgroundMapVisible}
        isOverlay={props.isOverlay}
        layersList={props.layersList}
        mapLayerOptions={props.mapLayerOptions}
        activeViewport={props.activeViewport}
        onMenuItemSelected={props.onMenuItemSelected}
        onItemVisibilityToggleClicked={props.onItemVisibilityToggleClicked}
        onItemSelected={props.onItemSelected}
        onItemEdited={props.onItemEdited}
      />
    </div>
  );
}
