/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import React from "react";

import type { StyleMapLayerSettings } from "../../Interfaces";
import { backgroundMapLayersId, overlayMapLayersId } from "../../widget/MapLayerDragModel";
import type { MapLayerSelectionActions, MapLayerState } from "./types";

export function useMapLayerSelectionActions(args: {
  backgroundLayers: StyleMapLayerSettings[];
  overlayLayers: StyleMapLayerSettings[];
  setMapLayers: React.Dispatch<React.SetStateAction<MapLayerState>>;
}): MapLayerSelectionActions {
  const { backgroundLayers, overlayLayers, setMapLayers } = args;

  const handleItemSelected = React.useCallback(
    (isOverlay: boolean, _index: number) => {
      if (isOverlay) {
        setMapLayers((prev) => ({ ...prev, [overlayMapLayersId]: [...overlayLayers] }));
      } else {
        setMapLayers((prev) => ({ ...prev, [backgroundMapLayersId]: [...backgroundLayers] }));
      }
    },
    [backgroundLayers, overlayLayers, setMapLayers],
  );

  const selectAllLayers = React.useCallback(
    (isOverlay: boolean) => {
      const layerList = isOverlay ? [...overlayLayers] : [...backgroundLayers];
      const hasCheckedLayer = undefined !== layerList.find((value) => value.selected === true);
      layerList.forEach((layer) => {
        layer.selected = !hasCheckedLayer;
      });

      setMapLayers((prev) => ({ ...prev, [isOverlay ? overlayMapLayersId : backgroundMapLayersId]: layerList }));
    },
    [backgroundLayers, overlayLayers, setMapLayers],
  );

  return {
    handleItemSelected,
    selectAllLayers,
  };
}
