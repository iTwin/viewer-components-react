/*---------------------------------------------------------------------------------------------
 * Map Layers MCP Tool Functions
 *
 * These functions operate on an iTwin.js ScreenViewport. They are designed to
 * be called from within a running iTwin.js application where `IModelApp` is
 * initialized and a viewport is available.
 *
 * The functions accept a generic viewport reference (typed as `any` to avoid
 * hard dependency on @itwin/core-frontend in the MCP server package). The host
 * application is responsible for providing the correctly-typed ScreenViewport.
 *--------------------------------------------------------------------------------------------*/

// We intentionally use `any` for viewport types so the MCP server package
// does not require @itwin/core-frontend or @itwin/core-common as dependencies.
// The host iTwin.js application that wires up the viewport accessor will have
// these types available at runtime.

// ── Types ────────────────────────────────────────────────────────────────────

export interface MapLayerInfo {
  name: string;
  source: string;
  visible: boolean;
  transparency: number;
  isOverlay: boolean;
  layerIndex: number;
  subLayers?: any[];
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function getViewport(vp: any): any {
  if (!vp) {
    throw new Error("No active viewport available.");
  }
  return vp;
}

function gatherLayers(vp: any, isOverlay: boolean): MapLayerInfo[] {
  const layers = isOverlay
    ? vp.displayStyle.settings.mapImagery.overlayLayers
    : vp.displayStyle.settings.mapImagery.backgroundLayers;

  return layers.map((layer: any, idx: number) => ({
    name: layer.name,
    source: layer.source ?? layer.modelId ?? "",
    visible: layer.visible,
    transparency: layer.transparency,
    isOverlay,
    layerIndex: idx,
    subLayers: layer.subLayers?.map((s: any) => (typeof s.toJSON === "function" ? s.toJSON() : s)) ?? undefined,
  }));
}

// ── 1. open_map_layers_widget ────────────────────────────────────────────────

/**
 * Opens (activates) the Map Layers widget in the frontstage.
 * Must run in an iTwin.js environment where `@itwin/appui-react` is loaded.
 */
export async function openMapLayersWidget(): Promise<string> {
  // Dynamic import so this module is only required at runtime inside iTwin.js
  const { UiFramework } = await import("@itwin/appui-react" as string);
  const widgetId = "map-layers:mapLayersWidget";
  UiFramework.frontstages.activeFrontstageDef?.findWidgetDef(widgetId)?.setWidgetState(1 /* WidgetState.Open */);
  return `Map Layers widget opened (id: ${widgetId}).`;
}

// ── 2. toggle_background_map ─────────────────────────────────────────────────

/**
 * Toggles background map visibility on/off, or sets it to a specific state.
 */
export function toggleBackgroundMap(
  vp: any,
  enabled?: boolean,
): { backgroundMapEnabled: boolean } {
  const viewport = getViewport(vp);
  const newState = enabled ?? !viewport.viewFlags.backgroundMap;
  viewport.viewFlags = viewport.viewFlags.with("backgroundMap", newState);
  return { backgroundMapEnabled: newState };
}

// ── 3. set_base_map_type ─────────────────────────────────────────────────────

/**
 * Sets the base map to one of the well-known Bing providers:
 *   "aerial" | "hybrid" | "street"
 * Or to a solid color fill when type is "color" + optional colorDef (TBGR integer).
 */
export async function setBaseMapType(
  vp: any,
  type: "aerial" | "hybrid" | "street" | "color",
  colorTbgr?: number,
): Promise<{ baseMap: string }> {
  const coreCommon = await import("@itwin/core-common" as string);
  const { BackgroundMapProvider, BackgroundMapType, BaseLayerSettings, ColorDef } = coreCommon;

  const viewport = getViewport(vp);

  if (type === "color") {
    const color = colorTbgr !== undefined ? ColorDef.fromJSON(colorTbgr) : ColorDef.fromJSON(0);
    viewport.displayStyle.backgroundMapBase = color;
    return { baseMap: `color (TBGR: ${color.toJSON()})` };
  }

  const bgTypeMap: Record<string, number> = {
    aerial: BackgroundMapType.Aerial,
    hybrid: BackgroundMapType.Hybrid,
    street: BackgroundMapType.Street,
  };
  const bgType = bgTypeMap[type] ?? BackgroundMapType.Hybrid;
  const provider = BackgroundMapProvider.fromJSON({ name: "BingProvider", type: bgType });
  const settings = BaseLayerSettings.fromProvider(provider);
  viewport.displayStyle.backgroundMapBase = settings;
  return { baseMap: type };
}

// ── 4. set_map_transparency ──────────────────────────────────────────────────

/**
 * Sets the background map transparency (0 = fully opaque, 1 = fully transparent).
 */
export function setMapTransparency(
  vp: any,
  transparency: number,
): { transparency: number } {
  const viewport = getViewport(vp);
  const clamped = Math.max(0, Math.min(1, transparency));
  viewport.changeBackgroundMapProps({ transparency: clamped });
  return { transparency: clamped };
}

// ── 5. toggle_terrain ────────────────────────────────────────────────────────

/**
 * Toggles terrain display on/off, or sets it to a specific state.
 */
export function toggleTerrain(
  vp: any,
  enabled?: boolean,
): { terrainEnabled: boolean } {
  const viewport = getViewport(vp);
  const currentlyEnabled = viewport.view?.getDisplayStyle3d?.()?.settings?.backgroundMap?.applyTerrain ?? false;
  const newState = enabled ?? !currentlyEnabled;
  viewport.changeBackgroundMapProps({ applyTerrain: newState });
  return { terrainEnabled: newState };
}

// ── 6. get_map_layer_info ────────────────────────────────────────────────────

/**
 * Returns information about all attached map layers (both background and overlay).
 */
export function getMapLayerInfo(
  vp: any,
): { backgroundLayers: MapLayerInfo[]; overlayLayers: MapLayerInfo[]; backgroundMapEnabled: boolean } {
  const viewport = getViewport(vp);
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
 *
 * @param url        The layer service URL (WMS, WMTS, ArcGIS, TileURL, etc.)
 * @param name       Display name for the layer
 * @param formatId   Format identifier: "WMS", "WMTS", "ArcGIS", "ArcGISFeature", "TileURL"
 * @param isOverlay  If true the layer is added as an overlay; otherwise as a background layer
 * @param userName   Optional credentials
 * @param password   Optional credentials
 */
export async function attachMapLayer(
  vp: any,
  url: string,
  name: string,
  formatId?: string,
  isOverlay?: boolean,
  userName?: string,
  password?: string,
): Promise<{ attached: boolean; name: string; isOverlay: boolean }> {
  const { MapLayerSource } = await import("@itwin/core-frontend" as string);

  const viewport = getViewport(vp);
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
  vp: any,
  name: string,
  isOverlay?: boolean,
): { detached: string[] } {
  const viewport = getViewport(vp);
  const detached: string[] = [];

  const tryDetach = (overlay: boolean) => {
    const layers = overlay
      ? viewport.displayStyle.settings.mapImagery.overlayLayers
      : viewport.displayStyle.settings.mapImagery.backgroundLayers;

    // Iterate in reverse so index removal is safe
    for (let i = layers.length - 1; i >= 0; i--) {
      if (layers[i].name === name) {
        viewport.displayStyle.detachMapLayerByIndex({ index: i, isOverlay: overlay });
        detached.push(`${name} (${overlay ? "overlay" : "background"}, index ${i})`);
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
  vp: any,
  name: string,
  visible: boolean,
  isOverlay?: boolean,
): { name: string; visible: boolean; updated: number } {
  const viewport = getViewport(vp);
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
