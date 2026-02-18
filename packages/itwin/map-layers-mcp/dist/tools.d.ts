export interface MapLayerInfo {
    name: string;
    source: string;
    visible: boolean;
    transparency: number;
    isOverlay: boolean;
    layerIndex: number;
    subLayers?: any[];
}
/**
 * Opens (activates) the Map Layers widget in the frontstage.
 * Must run in an iTwin.js environment where `@itwin/appui-react` is loaded.
 */
export declare function openMapLayersWidget(): Promise<string>;
/**
 * Toggles background map visibility on/off, or sets it to a specific state.
 */
export declare function toggleBackgroundMap(vp: any, enabled?: boolean): {
    backgroundMapEnabled: boolean;
};
/**
 * Sets the base map to one of the well-known Bing providers:
 *   "aerial" | "hybrid" | "street"
 * Or to a solid color fill when type is "color" + optional colorDef (TBGR integer).
 */
export declare function setBaseMapType(vp: any, type: "aerial" | "hybrid" | "street" | "color", colorTbgr?: number): Promise<{
    baseMap: string;
}>;
/**
 * Sets the background map transparency (0 = fully opaque, 1 = fully transparent).
 */
export declare function setMapTransparency(vp: any, transparency: number): {
    transparency: number;
};
/**
 * Toggles terrain display on/off, or sets it to a specific state.
 */
export declare function toggleTerrain(vp: any, enabled?: boolean): {
    terrainEnabled: boolean;
};
/**
 * Returns information about all attached map layers (both background and overlay).
 */
export declare function getMapLayerInfo(vp: any): {
    backgroundLayers: MapLayerInfo[];
    overlayLayers: MapLayerInfo[];
    backgroundMapEnabled: boolean;
};
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
export declare function attachMapLayer(vp: any, url: string, name: string, formatId?: string, isOverlay?: boolean, userName?: string, password?: string): Promise<{
    attached: boolean;
    name: string;
    isOverlay: boolean;
}>;
/**
 * Detaches a map layer by name (and optionally by overlay flag).
 * If multiple layers match, all are detached.
 */
export declare function detachMapLayer(vp: any, name: string, isOverlay?: boolean): {
    detached: string[];
};
/**
 * Sets the visibility of a specific map layer identified by name.
 */
export declare function setMapLayerVisibility(vp: any, name: string, visible: boolean, isOverlay?: boolean): {
    name: string;
    visible: boolean;
    updated: number;
};
