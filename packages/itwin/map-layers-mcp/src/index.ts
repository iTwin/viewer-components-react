/*---------------------------------------------------------------------------------------------
 * @itwin/map-layers-mcp
 *
 * Public API surface – re-exports the tool functions (for in-process use)
 * and the viewport accessor setter.
 *--------------------------------------------------------------------------------------------*/

export {
  openMapLayersWidget,
  toggleBackgroundMap,
  setBaseMapType,
  setMapTransparency,
  toggleTerrain,
  getMapLayerInfo,
  attachMapLayer,
  detachMapLayer,
  setMapLayerVisibility,
} from "./tools.js";

export type { MapLayerInfo } from "./tools.js";

export { setViewportAccessor } from "./server.js";
