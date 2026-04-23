/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
// cSpell:ignore droppable Sublayer Basemap

import "./MapLayerDroppable.scss";
import * as React from "react";
import { useDroppable } from "@dnd-kit/core";
import { SortableContext, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { UiFramework } from "@itwin/appui-react";
import { assert } from "@itwin/core-bentley";
import { ImageMapLayerSettings } from "@itwin/core-common";
import { IModelApp, MapLayerImageryProviderStatus, MapTileTreeScaleRangeVisibility, NotifyMessageDetails, OutputMessagePriority } from "@itwin/core-frontend";
import { SvgStatusWarning, SvgVisibilityHide, SvgVisibilityShow } from "@itwin/itwinui-icons-react";
import { Checkbox, IconButton } from "@itwin/itwinui-react";
import { MapLayersUI } from "../../mapLayers";
import { AttachLayerButtonType, AttachLayerPopupButton } from "./AttachLayerPopupButton";
import { backgroundMapLayersId, createMapLayerSortableId, overlayMapLayersId } from "./MapLayerDragDrop";
import { MapLayerSettingsMenu } from "./MapLayerSettingsMenu";
import { MapUrlDialog } from "./MapUrlDialog";
import { SubLayersPopupButton } from "./SubLayersPopupButton";

import type { SubLayerId } from "@itwin/core-common";
import type { MapLayerIndex, ScreenViewport } from "@itwin/core-frontend";
import type { MapLayerOptions, StyleMapLayerSettings } from "../Interfaces";
import type { SourceState } from "./MapUrlDialog";


/** @internal */
interface MapLayerDroppableProps {
  isOverlay: boolean;
  layersList?: StyleMapLayerSettings[];
  mapLayerOptions?: MapLayerOptions;
  getContainerForClone: () => HTMLElement;
  activeViewport: ScreenViewport;
  onMenuItemSelected: (action: string, mapLayerSettings: StyleMapLayerSettings) => void;
  onItemVisibilityToggleClicked: (mapLayerSettings: StyleMapLayerSettings) => void;
  onItemSelected: (isOverlay: boolean, index: number) => void;
  onItemEdited: () => void;
  disabled?: boolean;
}

interface MapLayerDragOverlayItemProps {
  mapLayerSettings: StyleMapLayerSettings;
  disabled?: boolean;
}

export function MapLayerDragOverlayItem(props: MapLayerDragOverlayItemProps) {
  const toggleVisibility = MapLayersUI.localization.getLocalizedString("mapLayers:Widget.ToggleVisibility");
  const requireAuthTooltip = MapLayersUI.localization.getLocalizedString("mapLayers:Widget.RequireAuthTooltip");
  const outOfRangeTitle = MapLayersUI.localization.getLocalizedString("mapLayers:Widget.layerOutOfRange");
  const outOfRange = props.mapLayerSettings.treeVisibility === MapTileTreeScaleRangeVisibility.Hidden;

  return (
    <div className="map-manager-source-item" data-testid="map-layer-drag-overlay-item">
      <Checkbox checked={props.mapLayerSettings.selected} disabled readOnly></Checkbox>
      <IconButton disabled size="small" styleType="borderless" className="map-manager-item-visibility" label={toggleVisibility}>
        {props.mapLayerSettings.visible ? (
          <SvgVisibilityShow data-testid="layer-visibility-icon-show" />
        ) : (
          <SvgVisibilityHide data-testid="layer-visibility-icon-hide" />
        )}
      </IconButton>
      <span
        className={props.disabled || outOfRange ? "map-manager-item-label-disabled" : "map-manager-item-label"}
        title={outOfRange ? outOfRangeTitle : undefined}
      >
        {props.mapLayerSettings.name}
      </span>

      {/* eslint-disable-next-line @itwin/no-internal */}
      {props.mapLayerSettings.provider?.status === MapLayerImageryProviderStatus.RequireAuth && (
        <IconButton disabled={true} size="small" styleType="borderless" label={requireAuthTooltip}>
          <SvgStatusWarning />
        </IconButton>
      )}
    </div>
  );
}

/** @internal */
export function MapLayerDroppable(props: MapLayerDroppableProps) {
  const containsLayer = props.layersList && props.layersList.length > 0;
  const droppableId = props.isOverlay ? overlayMapLayersId : backgroundMapLayersId;
  const [toggleVisibility] = React.useState(MapLayersUI.localization.getLocalizedString("mapLayers:Widget.ToggleVisibility"));
  const [requireAuthTooltip] = React.useState(MapLayersUI.localization.getLocalizedString("mapLayers:Widget.RequireAuthTooltip"));
  const [noBackgroundMapsSpecifiedLabel] = React.useState(MapLayersUI.localization.getLocalizedString("mapLayers:Widget.NoBackgroundLayers"));
  const [noUnderlaysSpecifiedLabel] = React.useState(MapLayersUI.localization.getLocalizedString("mapLayers:Widget.NoOverlayLayers"));
  const [dropLayerLabel] = React.useState(MapLayersUI.localization.getLocalizedString("mapLayers:Widget.DropLayerLabel"));
  const [outOfRangeTitle] = React.useState(MapLayersUI.localization.getLocalizedString("mapLayers:Widget.layerOutOfRange"));
  const sortableItems = props.layersList?.map((layer) => createMapLayerSortableId(droppableId, layer.name, layer.layerIndex)) ?? [];
  const { isOver, setNodeRef } = useDroppable({
    id: droppableId,
    data: {
      droppableId,
      index: containsLayer ? undefined : 0,
    },
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

  const renderItem = (activeLayer: StyleMapLayerSettings, index: number, sortable: ReturnType<typeof useSortable>) => {
    const outOfRange = activeLayer.treeVisibility === MapTileTreeScaleRangeVisibility.Hidden;

    return (
      <div
        className="map-manager-source-item"
        data-id={index}
        key={activeLayer.name}
        ref={sortable.setNodeRef}
        style={{
          visibility: sortable.isDragging ? "hidden" : undefined,
          transform: CSS.Transform.toString(sortable.transform),
          transition: sortable.transition,
          zIndex: sortable.isDragging ? 1 : undefined,
        }}
      >
        {/* Checkbox */}
        <Checkbox
          data-testid={"select-item-checkbox"}
          checked={activeLayer.selected}
          onChange={(event: React.ChangeEvent<HTMLInputElement>) => {
            activeLayer.selected = event.target.checked;
            props.onItemSelected(props.isOverlay, index);
          }}
        ></Checkbox>
        {/* Visibility icon */}
        <IconButton
          disabled={props.disabled}
          size="small"
          styleType="borderless"
          className="map-manager-item-visibility"
          label={toggleVisibility}
          onClick={() => {
            props.onItemVisibilityToggleClicked(activeLayer);
          }}
        >
          {activeLayer.visible ? <SvgVisibilityShow data-testid="layer-visibility-icon-show" /> : <SvgVisibilityHide data-testid="layer-visibility-icon-hide" />}
        </IconButton>

        {/* Label */}
        <span
          className={props.disabled || outOfRange ? "map-manager-item-label-disabled" : "map-manager-item-label"}
          title={outOfRange ? outOfRangeTitle : undefined}
          {...sortable.attributes}
          {...sortable.listeners}
        >
          {activeLayer.name}
          {/* eslint-disable-next-line @itwin/no-internal */}
          {activeLayer.provider?.status === MapLayerImageryProviderStatus.RequireAuth && (
            <IconButton
              disabled={props.disabled}
              size="small"
              styleType="borderless"
              onClick={() => {
                const indexInDisplayStyle = props.activeViewport?.displayStyle.findMapLayerIndexByNameAndSource(
                  activeLayer.name,
                  activeLayer.source,
                  activeLayer.isOverlay,
                );
                if (indexInDisplayStyle !== undefined && indexInDisplayStyle >= 0) {
                  const mapLayerIndex = { index: indexInDisplayStyle, isOverlay: activeLayer.isOverlay };
                  const layer = props.activeViewport.displayStyle.mapLayerAtIndex(mapLayerIndex);
                  if (layer instanceof ImageMapLayerSettings) {
                    UiFramework.dialogs.modal.open(
                      <MapUrlDialog
                        activeViewport={props.activeViewport}
                        signInModeArgs={{ layer }}
                        onOkResult={(sourceState?: SourceState) => handleOk(mapLayerIndex, sourceState)}
                        onCancelResult={() => {
                          UiFramework.dialogs.modal.close();
                        }}
                        mapLayerOptions={props.mapLayerOptions}
                      />,
                    );
                  }
                }
              }}
              label={requireAuthTooltip}
            >
              <SvgStatusWarning />
            </IconButton>
          )}
        </span>

        {/* SubLayersPopupButton */}
        <div className="map-manager-item-sub-layer-container map-layer-settings-sublayers-menu">
          {activeLayer.subLayers && activeLayer.subLayers.length > 1 && (
            <SubLayersPopupButton
              checkboxStyle="eye"
              expandMode="rootGroupOnly"
              subLayers={props.activeViewport ? activeLayer.subLayers : undefined}
              singleVisibleSubLayer={activeLayer.provider?.mutualExclusiveSubLayer}
              onSubLayerStateChange={(subLayerId: SubLayerId, isSelected: boolean) => {
                onSubLayerStateChange(activeLayer, subLayerId, isSelected);
              }}
            />
          )}
        </div>
        {/* eslint-disable-next-line @itwin/no-internal */}
        {activeLayer.provider?.status === MapLayerImageryProviderStatus.RequireAuth && (
          <IconButton
            disabled={props.disabled}
            size="small"
            styleType="borderless"
            onClick={() => {
              const indexInDisplayStyle = props.activeViewport?.displayStyle.findMapLayerIndexByNameAndSource(
                activeLayer.name,
                activeLayer.source,
                activeLayer.isOverlay,
              );
              if (indexInDisplayStyle !== undefined && indexInDisplayStyle >= 0) {
                const mapLayerIndex = { index: indexInDisplayStyle, isOverlay: activeLayer.isOverlay };
                const layer = props.activeViewport.displayStyle.mapLayerAtIndex(mapLayerIndex);
                if (layer instanceof ImageMapLayerSettings) {
                  UiFramework.dialogs.modal.open(
                    <MapUrlDialog
                      activeViewport={props.activeViewport}
                      signInModeArgs={{ layer }}
                      onOkResult={(sourceState?: SourceState) => handleOk(mapLayerIndex, sourceState)}
                      onCancelResult={() => {
                        UiFramework.dialogs.modal.close();
                      }}
                      mapLayerOptions={props.mapLayerOptions}
                    />,
                  );
                }
              }
            }}
            label={requireAuthTooltip}
          >
            <SvgStatusWarning />
          </IconButton>
        )}
        <div className="map-layer-settings-menu-wrapper">
          <MapLayerSettingsMenu
            activeViewport={props.activeViewport}
            mapLayerSettings={activeLayer}
            onMenuItemSelection={props.onMenuItemSelected}
            disabled={props.disabled}
          />
        </div>
      </div>
    );
  };

  function renderDraggableContent(): React.ReactNode {
    let node: React.ReactNode;
    if (containsLayer) {
      node = props.layersList?.map((mapLayerSettings, i) => (
        <SortableMapLayerItem
          key={createMapLayerSortableId(droppableId, mapLayerSettings.name, mapLayerSettings.layerIndex)}
          activeLayer={mapLayerSettings}
          disabled={props.disabled}
          droppableId={droppableId}
          index={i}
          renderItem={renderItem}
        />
      ));
    } else {
      const label = props.isOverlay ? noUnderlaysSpecifiedLabel : noBackgroundMapsSpecifiedLabel;
      node = (
        <div title={label} className="map-manager-no-layers-container">
          {isOver ? (
            <span className="map-manager-no-layers-label">{dropLayerLabel}</span>
          ) : (
            <>
              <span className="map-manager-no-layers-label">{label}</span>
              <AttachLayerPopupButton disabled={props.disabled} buttonType={AttachLayerButtonType.Blue} isOverlay={props.isOverlay} />
            </>
          )}
        </div>
      );
    }
    return node;
  }

  return (
    <div className={`map-manager-attachments${isOver && containsLayer ? " is-dragging-map-over" : ""}`} ref={setNodeRef}>
      <SortableContext items={sortableItems} strategy={verticalListSortingStrategy}>
        {renderDraggableContent()}
      </SortableContext>
    </div>
  );
}

interface SortableMapLayerItemProps {
  activeLayer: StyleMapLayerSettings;
  disabled?: boolean;
  droppableId: typeof overlayMapLayersId | typeof backgroundMapLayersId;
  index: number;
  renderItem: (activeLayer: StyleMapLayerSettings, index: number, sortable: ReturnType<typeof useSortable>) => React.ReactNode;
}

function SortableMapLayerItem(props: SortableMapLayerItemProps) {
  assert(props.activeLayer !== undefined);

  const sortable = useSortable({
    id: createMapLayerSortableId(props.droppableId, props.activeLayer.name, props.activeLayer.layerIndex),
    disabled: props.disabled,
    data: {
      droppableId: props.droppableId,
      index: props.index,
    },
  });

  return props.renderItem(props.activeLayer, props.index, sortable);
}
