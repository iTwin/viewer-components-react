/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import React from "react";
import { MapLayerActionButtons } from "./MapLayerActionButtons";
import { MapLayerDroppable } from "./MapLayerDroppable";

import type { ScreenViewport } from "@itwin/core-frontend";
import type { MapLayerOptions, StyleMapLayerSettings } from "../Interfaces";
import { AttachLayerPopupButton } from "./map-layer/AttachLayerPopupButton";

/** @internal */
interface MapLayersListProps {
  activeViewport: ScreenViewport;
  backgroundMapVisible: boolean;
  hasSelectedLayers: boolean;
  isOverlay: boolean;
  label: string;
  layersList: StyleMapLayerSettings[];
  mapLayerOptions?: MapLayerOptions;
  onHideAll: () => Promise<void>;
  onInvertAll: () => Promise<void>;
  onItemEdited: () => void;
  onItemSelected: (isOverlay: boolean, index: number) => void;
  onItemVisibilityToggleClicked: (mapLayerSettings: StyleMapLayerSettings) => void;
  onMenuItemSelected: (action: string, mapLayerSettings: StyleMapLayerSettings) => void;
  onSelectAll: () => Promise<void>;
  onShowAll: () => Promise<void>;
  onUnlink: () => Promise<void>;
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
          disabledUnlink={!props.hasSelectedLayers}
          hideAll={props.onHideAll}
          showAll={props.onShowAll}
          invert={props.onInvertAll}
          selectAll={props.onSelectAll}
          unlink={props.onUnlink}
          checked={props.hasSelectedLayers}
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
