/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
import React from "react";
import type { MapLayerIndex } from "@itwin/core-frontend";
import { IModelApp, MapLayerImageryProviderStatus, MapTileTreeScaleRangeVisibility, NotifyMessageDetails, OutputMessagePriority } from "@itwin/core-frontend";
import type { StyleMapLayerSettings } from "../Interfaces";
import { MapUrlDialog, type SourceState } from "./MapUrlDialog";
import { ImageMapLayerSettings, type SubLayerId } from "@itwin/core-common";
import type { useSortable } from "@dnd-kit/react/sortable";
import { Checkbox, IconButton } from "@itwin/itwinui-react";
import { SvgStatusWarning, SvgVisibilityHide, SvgVisibilityShow } from "@itwin/itwinui-icons-react";
import { UiFramework } from "@itwin/appui-react";
import { SubLayersPopupButton } from "./SubLayersPopupButton";
import { MapLayerSettingsMenu } from "./MapLayerSettingsMenu";
import { MapLayersUI } from "../../mapLayers";
import { useMapLayerListContext } from "../contexts/MapLayerListContext";

interface MapLayerItemProps {
  layer: StyleMapLayerSettings;
  index: number;
  sortable: ReturnType<typeof useSortable>;
}

export function MapLayerItem(props: MapLayerItemProps) {
  const context = useMapLayerListContext();
  const { layer, index, sortable } = props;
  const toggleVisibility = MapLayersUI.localization.getLocalizedString("mapLayers:Widget.ToggleVisibility");
  const requireAuthTooltip = MapLayersUI.localization.getLocalizedString("mapLayers:Widget.RequireAuthTooltip");
  const outOfRangeTitle = MapLayersUI.localization.getLocalizedString("mapLayers:Widget.layerOutOfRange");
  const outOfRange = layer.treeVisibility === MapTileTreeScaleRangeVisibility.Hidden;

  const onSubLayerStateChange = React.useCallback(
    (activeLayer: StyleMapLayerSettings, subLayerId: SubLayerId, isSelected: boolean) => {
      const mapLayerStyleIdx = context.activeViewport.displayStyle.findMapLayerIndexByNameAndSource(activeLayer.name, activeLayer.source, activeLayer.isOverlay);
      if (mapLayerStyleIdx !== -1 && activeLayer.subLayers) {
        context.activeViewport.displayStyle.changeMapSubLayerProps({ visible: isSelected }, subLayerId, {
          index: mapLayerStyleIdx,
          isOverlay: activeLayer.isOverlay,
        });
      }
    },
    [context.activeViewport],
  );

  const handleOk = React.useCallback(
    (mapLayerIndex: MapLayerIndex, sourceState?: SourceState) => {
      UiFramework.dialogs.modal.close();

      const source = sourceState?.source;
      if (sourceState === undefined || source === undefined) {
        const error = MapLayersUI.localization.getLocalizedString("mapLayers:Messages.MapLayerAttachMissingViewOrSource");
        const msg = MapLayersUI.localization.getLocalizedString("mapLayers:Messages.MapLayerAttachError", { error, sourceName: source?.name ?? "" });
        IModelApp.notifications.outputMessage(new NotifyMessageDetails(OutputMessagePriority.Error, msg));
        return;
      }

      const validation = sourceState.validation;

      // Layer is already attached,
      // This calls invalidateRenderPlan()
      context.activeViewport.displayStyle.changeMapLayerProps({ subLayers: validation.subLayers }, mapLayerIndex);
      context.activeViewport.displayStyle.changeMapLayerCredentials(mapLayerIndex, source.userName, source.password);

      // Either initial attach/initialize failed or the layer failed to load at least one tile
      // because of an invalid token; in both cases tile tree needs to be fully reset
      const provider = context.activeViewport.getMapLayerImageryProvider(mapLayerIndex);
      provider?.resetStatus();
      context.activeViewport.resetMapLayer(mapLayerIndex);

      context.onItemEdited();
    },
    [context],
  );

  return (
    <div
      className="map-manager-source-item"
      data-id={index}
      ref={sortable.ref}
      style={{
        position: sortable.isDragging ? "relative" : undefined,
        zIndex: sortable.isDragging ? 2 : undefined,
        boxShadow: sortable.isDragging ? "10px 5px 5px rgba(0, 0, 0, 0.15)" : undefined,
      }}
    >
      <Checkbox
        data-testid={"select-item-checkbox"}
        checked={layer.selected}
        onChange={(event: React.ChangeEvent<HTMLInputElement>) => {
          layer.selected = event.target.checked;
          context.onItemSelected(layer.isOverlay, index);
        }}
      />
      <IconButton
        disabled={context.disabled}
        size="small"
        styleType="borderless"
        className="map-manager-item-visibility"
        label={toggleVisibility}
        onClick={() => {
          context.onItemVisibilityToggleClicked(layer);
        }}
      >
        {layer.visible ? <SvgVisibilityShow data-testid="layer-visibility-icon-show" /> : <SvgVisibilityHide data-testid="layer-visibility-icon-hide" />}
      </IconButton>

      <span
        className={context.disabled || outOfRange ? "map-manager-item-label-disabled" : "map-manager-item-label"}
        ref={sortable.handleRef}
        style={{ cursor: context.disabled ? undefined : sortable.isDragging ? "grabbing" : "grab" }}
        title={outOfRange ? outOfRangeTitle : undefined}
      >
        {layer.name}
        {layer.provider?.status === MapLayerImageryProviderStatus.RequireAuth && (
          <IconButton
            disabled={context.disabled}
            size="small"
            styleType="borderless"
            onClick={() => {
              const indexInDisplayStyle = context.activeViewport.displayStyle.findMapLayerIndexByNameAndSource(
                layer.name,
                layer.source,
                layer.isOverlay,
              );
              if (indexInDisplayStyle !== undefined && indexInDisplayStyle >= 0) {
                const mapLayerIndex = { index: indexInDisplayStyle, isOverlay: layer.isOverlay };
                const layerSettings = context.activeViewport.displayStyle.mapLayerAtIndex(mapLayerIndex);
                if (layerSettings instanceof ImageMapLayerSettings) {
                  UiFramework.dialogs.modal.open(
                    <MapUrlDialog
                      activeViewport={context.activeViewport}
                      signInModeArgs={{ layer: layerSettings }}
                      onOkResult={(sourceState?: SourceState) => handleOk(mapLayerIndex, sourceState)}
                      onCancelResult={() => {
                        UiFramework.dialogs.modal.close();
                      }}
                      mapLayerOptions={context.mapLayerOptions}
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

      <div className="map-manager-item-sub-layer-container map-layer-settings-sublayers-menu">
        {layer.subLayers && layer.subLayers.length > 1 && (
          <SubLayersPopupButton
            checkboxStyle="eye"
            expandMode="rootGroupOnly"
            subLayers={layer.subLayers}
            singleVisibleSubLayer={layer.provider?.mutualExclusiveSubLayer}
            onSubLayerStateChange={(subLayerId: SubLayerId, isSelected: boolean) => {
              onSubLayerStateChange(layer, subLayerId, isSelected);
            }}
          />
        )}
      </div>
      {layer.provider?.status === MapLayerImageryProviderStatus.RequireAuth && (
        <IconButton
          disabled={context.disabled}
          size="small"
          styleType="borderless"
          onClick={() => {
            const indexInDisplayStyle = context.activeViewport.displayStyle.findMapLayerIndexByNameAndSource(
              layer.name,
              layer.source,
              layer.isOverlay,
            );
            if (indexInDisplayStyle !== undefined && indexInDisplayStyle >= 0) {
              const mapLayerIndex = { index: indexInDisplayStyle, isOverlay: layer.isOverlay };
              const layerSettings = context.activeViewport.displayStyle.mapLayerAtIndex(mapLayerIndex);
              if (layerSettings instanceof ImageMapLayerSettings) {
                UiFramework.dialogs.modal.open(
                  <MapUrlDialog
                    activeViewport={context.activeViewport}
                    signInModeArgs={{ layer: layerSettings }}
                    onOkResult={(sourceState?: SourceState) => handleOk(mapLayerIndex, sourceState)}
                    onCancelResult={() => {
                      UiFramework.dialogs.modal.close();
                    }}
                    mapLayerOptions={context.mapLayerOptions}
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
          activeViewport={context.activeViewport}
          mapLayerSettings={layer}
          onMenuItemSelection={context.onMenuItemSelected}
          disabled={context.disabled}
        />
      </div>
    </div>
  );
}
