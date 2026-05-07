/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
// cSpell:ignore droppable Sublayer Basemap

import "./MapLayerDroppable.scss";
import { MapLayersUI } from "../../mapLayers";
import { AttachLayerButtonType, AttachLayerPopupButton } from "./AttachLayerPopupButton";
import { backgroundMapLayersId, overlayMapLayersId } from "./MapLayerDragModel";
import { useDroppable } from "@dnd-kit/react";
import { useMapLayerListContext } from "../contexts/MapLayerListContext";

import type { StyleMapLayerSettings } from "../Interfaces";
import { SortableMapLayerItem } from "./SortableMapLayerItem";
import { MapLayerItem } from "./MapLayerItem";
import { CollisionPriority } from "@dnd-kit/abstract";

/** @internal */
interface MapLayerDroppableProps {
  isOverlay: boolean;
  layersList: StyleMapLayerSettings[];
  hideEmptyPlaceholder: boolean;
  showDropLayerHereWhenEmpty: boolean;
  showEmptyDropPlaceholder: boolean;
}

/** @internal */
export function MapLayerDroppable(props: MapLayerDroppableProps) {
  const context = useMapLayerListContext();
  const droppableId = props.isOverlay ? overlayMapLayersId : backgroundMapLayersId;
  const { isDropTarget, ref } = useDroppable({
    id: droppableId,
    type: "column",
    accept: "item",
    collisionPriority: CollisionPriority.Low,
  });

  const noBackgroundMapsSpecifiedLabel = MapLayersUI.localization.getLocalizedString("mapLayers:Widget.NoBackgroundLayers");
  const noUnderlaysSpecifiedLabel = MapLayersUI.localization.getLocalizedString("mapLayers:Widget.NoOverlayLayers");
  const dropLayerLabel = MapLayersUI.localization.getLocalizedString("mapLayers:Widget.DropLayerLabel");
  const title = props.isOverlay ? noUnderlaysSpecifiedLabel : noBackgroundMapsSpecifiedLabel;
  const showDropHint = context.dropTargetId === droppableId;
  const showEmptyDropHint = props.showDropLayerHereWhenEmpty || isDropTarget || showDropHint;
  const isActiveDropTarget = isDropTarget || showDropHint;
  const className = [
    "map-manager-attachments",
    context.isDraggingMapLayer ? "map-manager-attachments--drop-available" : undefined,
    isActiveDropTarget ? "map-manager-attachments--drop-target" : undefined,
  ].filter(Boolean).join(" ");

  return (
    <div className={className} ref={ref} key={droppableId}>
      {props.layersList.length > 0 && !props.showEmptyDropPlaceholder ?
        <>
          {props.layersList.map((mapLayerSettings, i) => (
            <SortableMapLayerItem
              key={mapLayerSettings.id}
              layer={mapLayerSettings}
              disabled={context.disabled}
              droppableId={droppableId}
              index={i}
              renderItem={(sortable) =>
                <MapLayerItem
                  key={mapLayerSettings.id}
                  layer={mapLayerSettings}
                  index={i}
                  sortable={sortable}
                />
              }
            />
          ))}
        </>
        : props.hideEmptyPlaceholder ? undefined
        : <div title={title} className="map-manager-no-layers-container">
            <span className="map-manager-no-layers-label">{showEmptyDropHint ? dropLayerLabel : title}</span>
            {!showEmptyDropHint && <AttachLayerPopupButton disabled={context.disabled} buttonType={AttachLayerButtonType.Blue} isOverlay={props.isOverlay} />}
          </div>
      }
    </div>
  );
}
