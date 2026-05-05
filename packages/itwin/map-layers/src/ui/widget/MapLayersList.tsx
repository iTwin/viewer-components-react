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
import type { MapLayerDroppableId } from "./MapLayerDragDrop";

/** @internal */
interface MapLayersListProps {
  activeViewport: ScreenViewport;
  backgroundMapVisible: boolean;
  isOverlay: boolean;
  isDraggingMapLayer: boolean;
  label: string;
  actionButtonsLayersList: StyleMapLayerSettings[];
  layersList: StyleMapLayerSettings[];
  mapLayerOptions?: MapLayerOptions;
  onItemEdited: () => void;
  onItemSelected: (isOverlay: boolean, index: number) => void;
  onItemVisibilityToggleClicked: (mapLayerSettings: StyleMapLayerSettings) => void;
  onMenuItemSelected: (action: string, mapLayerSettings: StyleMapLayerSettings) => void;
  dropTargetId?: MapLayerDroppableId;
  hideEmptyPlaceholder: boolean;
  showDropLayerHereWhenEmpty: boolean;
  showEmptyDropPlaceholder: boolean;
}

/** @internal */
export function MapLayersList(props: MapLayersListProps) {
  return (
    <div className="map-manager-layer-wrapper" data-testid="map-manager-layer-section">
      <div className="map-manager-layers">
        <span className="map-manager-layers-label">{props.label}</span>
        <AttachLayerPopupButton disabled={!props.backgroundMapVisible} isOverlay={props.isOverlay} />
      </div>
      {props.actionButtonsLayersList.length > 0 && !props.showEmptyDropPlaceholder && (
        <MapLayerActionButtons
          disabled={!props.backgroundMapVisible}
          isOverlay={props.isOverlay}
          layersList={props.actionButtonsLayersList}
          activeViewport={props.activeViewport}
        />
      )}
      <MapLayerDroppable
        disabled={!props.backgroundMapVisible}
        isOverlay={props.isOverlay}
        isDraggingMapLayer={props.isDraggingMapLayer}
        layersList={props.layersList}
        mapLayerOptions={props.mapLayerOptions}
        activeViewport={props.activeViewport}
        onMenuItemSelected={props.onMenuItemSelected}
        onItemVisibilityToggleClicked={props.onItemVisibilityToggleClicked}
        onItemSelected={props.onItemSelected}
        onItemEdited={props.onItemEdited}
        dropTargetId={props.dropTargetId}
        hideEmptyPlaceholder={props.hideEmptyPlaceholder}
        showDropLayerHereWhenEmpty={props.showDropLayerHereWhenEmpty}
        showEmptyDropPlaceholder={props.showEmptyDropPlaceholder}
      />
    </div>
  );
}
