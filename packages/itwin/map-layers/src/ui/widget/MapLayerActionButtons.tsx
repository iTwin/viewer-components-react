/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
import * as React from "react";
import { SvgUnlink, SvgVisibilityHalf, SvgVisibilityHide, SvgVisibilityShow } from "@itwin/itwinui-icons-react";
import { ButtonGroup, Checkbox, IconButton } from "@itwin/itwinui-react";
import { MapLayersUI } from "../../mapLayers";
import { useSourceMapContext } from "./MapLayerManager";
import type { ScreenViewport } from "@itwin/core-frontend";
import type { StyleMapLayerSettings } from "../Interfaces";

interface MapLayerActionButtonsProps {
  disabled: boolean;
  isOverlay: boolean;
  layersList: StyleMapLayerSettings[];
  activeViewport: ScreenViewport;
}

export const MapLayerActionButtons = ({ disabled, isOverlay, layersList, activeViewport }: MapLayerActionButtonsProps) => {
  const showAllLabel = MapLayersUI.localization.getLocalizedString("mapLayers:MapLayerActionButtons.ShowAllLabel");
  const hideAllLabel = MapLayersUI.localization.getLocalizedString("mapLayers:MapLayerActionButtons.HideAllLabel");
  const invertAllLabel = MapLayersUI.localization.getLocalizedString("mapLayers:MapLayerActionButtons.InvertAllLabel");
  const detachSelectedLabel = MapLayersUI.localization.getLocalizedString("mapLayers:MapLayerActionButtons.DetachSelectedLabel");

  const { selectAllLayers } = useSourceMapContext();
  const hasSelected = layersList.some((l) => l.selected);

  const showAll = React.useCallback(async () => {
    layersList.forEach((layer) => {
      activeViewport.displayStyle.changeMapLayerProps({ visible: true }, { index: layer.layerIndex, isOverlay: layer.isOverlay });
    });
  }, [layersList, activeViewport]);

  const hideAll = React.useCallback(async () => {
    layersList.forEach((layer) => {
      activeViewport.displayStyle.changeMapLayerProps({ visible: false }, { index: layer.layerIndex, isOverlay: layer.isOverlay });
    });
  }, [layersList, activeViewport]);

  const invertAll = React.useCallback(async () => {
    layersList.forEach((layer) => {
      activeViewport.displayStyle.changeMapLayerProps({ visible: !layer.visible }, { index: layer.layerIndex, isOverlay: layer.isOverlay });
    });
  }, [layersList, activeViewport]);

  const unlink = React.useCallback(async () => {
    for (let i = 0; i < layersList.length; i++) {
      if (layersList[i].selected) {
        const index = layersList.length - 1 - i;
        activeViewport.displayStyle.detachMapLayerByIndex({ isOverlay, index });
      }
    }
  }, [layersList, activeViewport, isOverlay]);

  const selectAll = React.useCallback(async () => {
    selectAllLayers(isOverlay);
  }, [selectAllLayers, isOverlay]);

  return (
    <div className="map-manager-layer-action-buttons">
      <Checkbox data-testid="select-all-checkbox" checked={hasSelected} onChange={selectAll} className="map-manager-layer-action-unlink-button" />
      <IconButton disabled={disabled || !hasSelected} data-testid="detach-label-button" label={detachSelectedLabel} size="small" styleType="borderless" onClick={unlink}>
        <SvgUnlink />
      </IconButton>
      <ButtonGroup className="map-manager-layer-action-buttons-inside-separator">
        <IconButton disabled={disabled} data-testid="show-all-label-button" label={showAllLabel} size="small" onClick={showAll} styleType="borderless">
          <SvgVisibilityShow />
        </IconButton>
        <IconButton disabled={disabled} data-testid="invert-all-label-button" label={invertAllLabel} size="small" styleType="borderless" onClick={invertAll}>
          <SvgVisibilityHalf />
        </IconButton>
        <IconButton disabled={disabled} data-testid="hide-all-label-button" label={hideAllLabel} size="small" styleType="borderless" onClick={hideAll}>
          <SvgVisibilityHide />
        </IconButton>
      </ButtonGroup>
    </div>
  );
};
