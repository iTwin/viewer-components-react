/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

/**
 * @itwin/map-layers/mcp — public API surface.
 *
 * Import from `@itwin/map-layers/mcp` to get the MCP tool functions,
 * viewport accessor, and startServer for in-process usage.
 */

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
} from "./tools";

export type { MapLayerInfo } from "./tools";

export { setViewportAccessor } from "./viewport";
export { startServer } from "./server";
