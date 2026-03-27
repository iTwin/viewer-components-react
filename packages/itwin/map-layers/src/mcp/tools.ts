/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

/**
 * MCP tool functions that operate on an iTwin.js ScreenViewport.
 *
 * These are pure functions designed to be called from the MCP server handlers
 * or directly from an in-process consumer. Since this file lives inside the
 * `@itwin/map-layers` package it has direct access to iTwin.js types.
 */

import type { ScreenViewport } from "@itwin/core-frontend";
import {
  BackgroundMapProvider,
  BackgroundMapType,
  BaseMapLayerSettings,
  ColorDef,
} from "@itwin/core-common";
import { MapLayerSource } from "@itwin/core-frontend";
import { UiFramework, WidgetState } from "@itwin/appui-react";

// ── Types ────────────────────────────────────────────────────────────────────

export interface MapLayerInfo {
  name: string;
  source: string;
  visible: boolean;
  transparency: number;
  isOverlay: boolean;
  layerIndex: number;
  subLayers?: unknown[];
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function requireViewport(vp: ScreenViewport | undefined): ScreenViewport {
  if (!vp) {
    throw new Error("No active viewport available.");
  }
  return vp;
}

function gatherLayers(vp: ScreenViewport, isOverlay: boolean): MapLayerInfo[] {
  const layers = isOverlay
    ? vp.displayStyle.settings.mapImagery.overlayLayers
    : vp.displayStyle.settings.mapImagery.backgroundLayers;

  return layers.map((layer, idx) => ({
    name: layer.name,
    source: (layer as any).source ?? (layer as any).modelId ?? "",
    visible: layer.visible,
    transparency: layer.transparency,
    isOverlay,
    layerIndex: idx,
    subLayers:
      (layer as any).subLayers?.map((s: any) =>
        typeof s.toJSON === "function" ? s.toJSON() : s,
      ) ?? undefined,
  }));
}

// ── 1. open_map_layers_widget ────────────────────────────────────────────────

/**
 * Opens (activates) the Map Layers widget in the frontstage.
 */
export function openMapLayersWidget(): string {
  const widgetId = "map-layers:mapLayersWidget";
  UiFramework.frontstages.activeFrontstageDef
    ?.findWidgetDef(widgetId)
    ?.setWidgetState(WidgetState.Open);
  return `Map Layers widget opened (id: ${widgetId}).`;
}

// ── 2. toggle_background_map ─────────────────────────────────────────────────

/**
 * Toggles background map visibility on/off, or sets it to a specific state.
 */
export function toggleBackgroundMap(
  vp: ScreenViewport | undefined,
  enabled?: boolean,
): { backgroundMapEnabled: boolean } {
  const viewport = requireViewport(vp);
  const newState = enabled ?? !viewport.viewFlags.backgroundMap;
  viewport.viewFlags = viewport.viewFlags.with("backgroundMap", newState);
  return { backgroundMapEnabled: newState };
}

// ── 3. set_base_map_type ─────────────────────────────────────────────────────

/**
 * Sets the base map to one of the well-known Bing providers or a solid color.
 */
export function setBaseMapType(
  vp: ScreenViewport | undefined,
  type: "aerial" | "hybrid" | "street" | "color",
  colorTbgr?: number,
): { baseMap: string } {
  const viewport = requireViewport(vp);

  if (type === "color") {
    const color =
      colorTbgr !== undefined
        ? ColorDef.fromJSON(colorTbgr)
        : ColorDef.fromJSON(0);
    viewport.displayStyle.backgroundMapBase = color;
    return { baseMap: `color (TBGR: ${color.toJSON()})` };
  }

  const bgTypeMap: Record<string, BackgroundMapType> = {
    aerial: BackgroundMapType.Aerial,
    hybrid: BackgroundMapType.Hybrid,
    street: BackgroundMapType.Street,
  };
  const bgType = bgTypeMap[type] ?? BackgroundMapType.Hybrid;
  const provider = BackgroundMapProvider.fromJSON({
    name: "BingProvider",
    type: bgType,
  });
  const settings = BaseMapLayerSettings.fromProvider(provider);
  viewport.displayStyle.backgroundMapBase = settings;
  return { baseMap: type };
}

// ── 4. set_map_transparency ──────────────────────────────────────────────────

/**
 * Sets the background map transparency (0 = fully opaque, 1 = fully transparent).
 */
export function setMapTransparency(
  vp: ScreenViewport | undefined,
  transparency: number,
): { transparency: number } {
  const viewport = requireViewport(vp);
  const clamped = Math.max(0, Math.min(1, transparency));
  viewport.changeBackgroundMapProps({ transparency: clamped });
  return { transparency: clamped };
}

// ── 5. toggle_terrain ────────────────────────────────────────────────────────

/**
 * Toggles terrain display on/off, or sets it to a specific state.
 */
export function toggleTerrain(
  vp: ScreenViewport | undefined,
  enabled?: boolean,
): { terrainEnabled: boolean } {
  const viewport = requireViewport(vp);
  const currentlyEnabled =
    (viewport.view as any)?.getDisplayStyle3d?.()?.settings?.backgroundMap
      ?.applyTerrain ?? false;
  const newState = enabled ?? !currentlyEnabled;
  viewport.changeBackgroundMapProps({ applyTerrain: newState });
  return { terrainEnabled: newState };
}

// ── 6. get_map_layer_info ────────────────────────────────────────────────────

/**
 * Returns information about all attached map layers (both background and overlay).
 */
export function getMapLayerInfo(vp: ScreenViewport | undefined): {
  backgroundLayers: MapLayerInfo[];
  overlayLayers: MapLayerInfo[];
  backgroundMapEnabled: boolean;
} {
  const viewport = requireViewport(vp);
  const backgroundLayers = gatherLayers(viewport, false);
  const overlayLayers = gatherLayers(viewport, true);
  return {
    backgroundLayers,
    overlayLayers,
    backgroundMapEnabled: viewport.viewFlags.backgroundMap,
  };
}

// ── 7. attach_map_layer ──────────────────────────────────────────────────────

/**
 * Attaches a new map layer to the viewport by URL.
 */
export function attachMapLayer(
  vp: ScreenViewport | undefined,
  url: string,
  name: string,
  formatId?: string,
  isOverlay?: boolean,
  userName?: string,
  password?: string,
): { attached: boolean; name: string; isOverlay: boolean } {
  const viewport = requireViewport(vp);
  const overlay = isOverlay ?? false;

  const source = MapLayerSource.fromJSON({
    url,
    name,
    formatId: formatId ?? "WMS",
  });
  if (!source) {
    throw new Error(`Failed to create map layer source from URL: ${url}`);
  }

  if (userName) source.userName = userName;
  if (password) source.password = password;

  const settings = source.toLayerSettings();
  if (!settings) {
    throw new Error(`Failed to create layer settings for source: ${name}`);
  }

  viewport.displayStyle.attachMapLayer({
    settings,
    mapLayerIndex: { index: -1, isOverlay: overlay },
  });

  return { attached: true, name, isOverlay: overlay };
}

// ── 8. detach_map_layer ──────────────────────────────────────────────────────

/**
 * Detaches a map layer by name (and optionally by overlay flag).
 * If multiple layers match, all are detached.
 */
export function detachMapLayer(
  vp: ScreenViewport | undefined,
  name: string,
  isOverlay?: boolean,
): { detached: string[] } {
  const viewport = requireViewport(vp);
  const detached: string[] = [];

  const tryDetach = (overlay: boolean) => {
    const layers = overlay
      ? viewport.displayStyle.settings.mapImagery.overlayLayers
      : viewport.displayStyle.settings.mapImagery.backgroundLayers;

    // Iterate in reverse so index removal is safe
    for (let i = layers.length - 1; i >= 0; i--) {
      if (layers[i].name === name) {
        viewport.displayStyle.detachMapLayerByIndex({
          index: i,
          isOverlay: overlay,
        });
        detached.push(
          `${name} (${overlay ? "overlay" : "background"}, index ${i})`,
        );
      }
    }
  };

  if (isOverlay === undefined) {
    tryDetach(false);
    tryDetach(true);
  } else {
    tryDetach(isOverlay);
  }

  if (detached.length === 0) {
    throw new Error(`No map layer found with name "${name}".`);
  }
  return { detached };
}

// ── 9. set_map_layer_visibility ──────────────────────────────────────────────

/**
 * Sets the visibility of a specific map layer identified by name.
 */
export function setMapLayerVisibility(
  vp: ScreenViewport | undefined,
  name: string,
  visible: boolean,
  isOverlay?: boolean,
): { name: string; visible: boolean; updated: number } {
  const viewport = requireViewport(vp);
  let updated = 0;

  const trySetVisibility = (overlay: boolean) => {
    const layers = overlay
      ? viewport.displayStyle.settings.mapImagery.overlayLayers
      : viewport.displayStyle.settings.mapImagery.backgroundLayers;

    for (let i = 0; i < layers.length; i++) {
      if (layers[i].name === name) {
        viewport.displayStyle.changeMapLayerProps(
          { visible },
          { index: i, isOverlay: overlay },
        );
        updated++;
      }
    }
  };

  if (isOverlay === undefined) {
    trySetVisibility(false);
    trySetVisibility(true);
  } else {
    trySetVisibility(isOverlay);
  }

  if (updated === 0) {
    throw new Error(`No map layer found with name "${name}".`);
  }
  return { name, visible, updated };
}
