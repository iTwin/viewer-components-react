/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
// cSpell:ignore droppable Sublayer Basemap

import "./MapLayerDroppable.scss";
import React from "react";
import { UiFramework } from "@itwin/appui-react";
import { IModelApp, NotifyMessageDetails, OutputMessagePriority } from "@itwin/core-frontend";
import { MapLayersUI } from "../../mapLayers";
import { AttachLayerButtonType, AttachLayerPopupButton } from "./AttachLayerPopupButton";
import { backgroundMapLayersId, overlayMapLayersId } from "./MapLayerDragDrop";
import { useDroppable } from "@dnd-kit/react";

import type { SubLayerId } from "@itwin/core-common";
import type { MapLayerIndex, ScreenViewport } from "@itwin/core-frontend";
import type { MapLayerOptions, StyleMapLayerSettings } from "../Interfaces";
import type { SourceState } from "./MapUrlDialog";
import { SortableMapLayerItem } from "./SortableMapLayerItem";
import { MapLayerItem } from "./MapLayerItem";
import { CollisionPriority } from "@dnd-kit/abstract";


/** @internal */
interface MapLayerDroppableProps {
  isOverlay: boolean;
  layersList?: StyleMapLayerSettings[];
  mapLayerOptions?: MapLayerOptions;
  activeViewport: ScreenViewport;
  onMenuItemSelected: (action: string, mapLayerSettings: StyleMapLayerSettings) => void;
  onItemVisibilityToggleClicked: (mapLayerSettings: StyleMapLayerSettings) => void;
  onItemSelected: (isOverlay: boolean, index: number) => void;
  onItemEdited: () => void;
  disabled?: boolean;
}

/** @internal */
export function MapLayerDroppable(props: MapLayerDroppableProps) {
  const droppableId = props.isOverlay ? overlayMapLayersId : backgroundMapLayersId;
  const [toggleVisibility] = React.useState(MapLayersUI.localization.getLocalizedString("mapLayers:Widget.ToggleVisibility"));
  const [requireAuthTooltip] = React.useState(MapLayersUI.localization.getLocalizedString("mapLayers:Widget.RequireAuthTooltip"));
  const [outOfRangeTitle] = React.useState(MapLayersUI.localization.getLocalizedString("mapLayers:Widget.layerOutOfRange"));
  const { isDropTarget, ref } = useDroppable({
    id: droppableId,
    type: "column",
    accept: "item",
    collisionPriority: CollisionPriority.Low,
  });

  const onSubLayerStateChange = (activeLayer: StyleMapLayerSettings, subLayerId: SubLayerId, isSelected: boolean) => {
    const mapLayerStyleIdx = props.activeViewport.displayStyle.findMapLayerIndexByNameAndSource(activeLayer.name, activeLayer.source, activeLayer.isOverlay);
    if (mapLayerStyleIdx !== -1 && activeLayer.subLayers) {
      props.activeViewport.displayStyle.changeMapSubLayerProps({ visible: isSelected }, subLayerId, {
        index: mapLayerStyleIdx,
        isOverlay: activeLayer.isOverlay,
      });
    }
  };

  const handleOk = React.useCallback(
    (index: MapLayerIndex, sourceState?: SourceState) => {
      UiFramework.dialogs.modal.close();

      const source = sourceState?.source;
      const vp = props?.activeViewport;
      if (vp === undefined || sourceState === undefined || source === undefined) {
        const error = MapLayersUI.localization.getLocalizedString("mapLayers:Messages.MapLayerAttachMissingViewOrSource");
        const msg = MapLayersUI.localization.getLocalizedString("mapLayers:Messages.MapLayerAttachError", { error, sourceName: source?.name ?? "" });
        IModelApp.notifications.outputMessage(new NotifyMessageDetails(OutputMessagePriority.Error, msg));
        return;
      }

      const validation = sourceState.validation;

      // Layer is already attached,
      // This calls invalidateRenderPlan()
      vp.displayStyle.changeMapLayerProps({ subLayers: validation.subLayers }, index);
      vp.displayStyle.changeMapLayerCredentials(index, source.userName, source.password);

      // Either initial attach/initialize failed or the layer failed to load at least one tile
      // because of an invalid token; in both cases tile tree needs to be fully reset
      const provider = vp.getMapLayerImageryProvider(index);
      provider?.resetStatus();
      vp.resetMapLayer(index);

      props.onItemEdited();
    },
    [props],
  );

  const noBackgroundMapsSpecifiedLabel = MapLayersUI.localization.getLocalizedString("mapLayers:Widget.NoBackgroundLayers");
  const noUnderlaysSpecifiedLabel = MapLayersUI.localization.getLocalizedString("mapLayers:Widget.NoOverlayLayers");
  const dropLayerLabel = MapLayersUI.localization.getLocalizedString("mapLayers:Widget.DropLayerLabel");
  const title = props.isOverlay ? noUnderlaysSpecifiedLabel : noBackgroundMapsSpecifiedLabel;

  return (
    <div className="map-manager-attachments" ref={ref} key={droppableId}>
      {props.layersList && props.layersList.length > 0 ?
        props.layersList.map((mapLayerSettings, i) => (
          <SortableMapLayerItem
            key={mapLayerSettings.id}
            layer={mapLayerSettings}
            disabled={props.disabled}
            droppableId={droppableId}
            index={i}
            renderItem={(sortable) =>
              <MapLayerItem
                key={mapLayerSettings.id}
                id={mapLayerSettings.id}
                activeLayer={mapLayerSettings}
                activeViewport={props.activeViewport}
                disabled={props.disabled}
                handleOk={handleOk}
                index={i}
                isOverlay={props.isOverlay}
                mapLayerOptions={props.mapLayerOptions}
                onItemSelected={props.onItemSelected}
                onItemVisibilityToggleClicked={props.onItemVisibilityToggleClicked}
                onMenuItemSelected={props.onMenuItemSelected}
                onSubLayerStateChange={onSubLayerStateChange}
                outOfRangeTitle={outOfRangeTitle}
                requireAuthTooltip={requireAuthTooltip}
                sortable={sortable}
                toggleVisibility={toggleVisibility}
              />
            }
          />
        ))
        : <div title={title} className="map-manager-no-layers-container">
          {isDropTarget ? (
            <span className="map-manager-no-layers-label">{dropLayerLabel}</span>
          ) : (
            <>
              <span className="map-manager-no-layers-label">{title}</span>
              <AttachLayerPopupButton disabled={props.disabled} buttonType={AttachLayerButtonType.Blue} isOverlay={props.isOverlay} />
            </>
          )}
        </div>
      }
    </div>
  );
}
