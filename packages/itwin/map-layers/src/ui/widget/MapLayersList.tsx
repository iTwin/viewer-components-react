/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import React from "react";
import { MapLayerActionButtons } from "./MapLayerActionButtons";
import { MapLayerDroppable } from "./MapLayerDroppable";

import type { StyleMapLayerSettings } from "../Interfaces";
import { AttachLayerPopupButton } from "./AttachLayerPopupButton";
import { useMapLayerListContext } from "../contexts/MapLayerListContext";
import { MapLayersUI } from "../../mapLayers";
import { backgroundMapLayersId, overlayMapLayersId } from "./MapLayerDragModel";

/** @internal */
interface MapLayersListProps {
  isOverlay: boolean;
  layersList: StyleMapLayerSettings[];
  dragStartLayersList?: StyleMapLayerSettings[];
}

/** @internal */
export function MapLayersList(props: MapLayersListProps) {
  const context = useMapLayerListContext();
  const droppableId = props.isOverlay ? overlayMapLayersId : backgroundMapLayersId;
  const overlaysLabel = MapLayersUI.localization.getLocalizedString("mapLayers:Widget.OverlayLayers");
  const backgroundsLabel = MapLayersUI.localization.getLocalizedString("mapLayers:Widget.BackgroundLayers");
  const wasEmptyAtDragStart = context.isDraggingMapLayer && props.dragStartLayersList?.length === 0;
  const becameEmptyDuringDrag = context.isDraggingMapLayer && !wasEmptyAtDragStart && props.layersList.length === 0;
  const showEmptyDropPlaceholder = context.dropTargetId === droppableId && wasEmptyAtDragStart && props.layersList.length === 0;
  const actionButtonsLayersList = becameEmptyDuringDrag ? props.dragStartLayersList ?? props.layersList : props.layersList;

  return (
    <div className="map-manager-layer-wrapper" data-testid="map-manager-layer-section">
      <div className="map-manager-layers">
        <span className="map-manager-layers-label">{props.isOverlay ? overlaysLabel : backgroundsLabel}</span>
        <AttachLayerPopupButton disabled={context.disabled} isOverlay={props.isOverlay} />
      </div>
      <MapLayerActionButtons
        isOverlay={props.isOverlay}
        layersList={actionButtonsLayersList}
      />
      <MapLayerDroppable
        isOverlay={props.isOverlay}
        layersList={props.layersList}
        hideEmptyPlaceholder={becameEmptyDuringDrag}
        showDropLayerHereWhenEmpty={wasEmptyAtDragStart}
        showEmptyDropPlaceholder={showEmptyDropPlaceholder}
      />
    </div>
  );
}
