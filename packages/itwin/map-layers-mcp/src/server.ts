/*---------------------------------------------------------------------------------------------
 * Map Layers MCP Server
 *
 * Exposes iTwin.js map-layer operations as MCP tools over stdio transport.
 * The server communicates with a host iTwin.js application that provides
 * viewport access — the host is expected to inject or relay viewport calls.
 *
 * This module only **defines** the server and its tool registrations.
 * It does NOT auto-start. Use `startServer()` or the CLI entry point
 * (`cli.ts` / `dist/cli.js`) to actually start the stdio transport.
 *--------------------------------------------------------------------------------------------*/

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { getViewportAccessor } from "./viewport.js";

const _getViewport = getViewportAccessor;

// ---------------------------------------------------------------------------
// Server
// ---------------------------------------------------------------------------

const server = new McpServer({
  name: "map-layers-mcp",
  version: "1.0.0",
});

// ── 1. open_map_layers_widget ────────────────────────────────────────────────

server.tool(
  "open_map_layers_widget",
  "Opens the Map Layers widget panel in the iTwin.js frontstage UI so the user can manage map layers visually.",
  {},
  async () => {
    try {
      const { openMapLayersWidget } = await import("./tools.js");
      const msg = await openMapLayersWidget();
      return { content: [{ type: "text", text: msg }] };
    } catch (e: any) {
      return { content: [{ type: "text", text: JSON.stringify({ action: "open_map_layers_widget" }) }] };
    }
  },
);

// ── 2. toggle_background_map ─────────────────────────────────────────────────

server.tool(
  "toggle_background_map",
  "Toggles the background map on or off. If 'enabled' is provided, sets it to that state; otherwise toggles.",
  {
    enabled: z.boolean().optional().describe("If provided, force the background map to this state (true = on, false = off). Omit to toggle."),
  },
  async ({ enabled }) => {
    try {
      const { toggleBackgroundMap } = await import("./tools.js");
      const result = toggleBackgroundMap(_getViewport(), enabled);
      return { content: [{ type: "text", text: JSON.stringify(result) }] };
    } catch (e: any) {
      return { content: [{ type: "text", text: JSON.stringify({ action: "toggle_background_map", enabled }) }] };
    }
  },
);

// ── 3. set_base_map_type ─────────────────────────────────────────────────────

server.tool(
  "set_base_map_type",
  "Changes the base map to one of the well-known types: aerial, hybrid, street, or a solid color fill.",
  {
    type: z.enum(["aerial", "hybrid", "street", "color"]).describe("The base map type to set."),
    colorTbgr: z.number().optional().describe("TBGR color integer when type is 'color'. Ignored otherwise."),
  },
  async ({ type, colorTbgr }) => {
    try {
      const { setBaseMapType } = await import("./tools.js");
      const result = await setBaseMapType(_getViewport(), type, colorTbgr);
      return { content: [{ type: "text", text: JSON.stringify(result) }] };
    } catch (e: any) {
      return { content: [{ type: "text", text: JSON.stringify({ action: "set_base_map_type", type, colorTbgr }) }] };
    }
  },
);

// ── 4. set_map_transparency ──────────────────────────────────────────────────

server.tool(
  "set_map_transparency",
  "Sets the transparency of the background map. 0 = fully opaque, 1 = fully transparent.",
  {
    transparency: z.number().min(0).max(1).describe("Transparency value from 0.0 (opaque) to 1.0 (transparent)."),
  },
  async ({ transparency }) => {
    try {
      const { setMapTransparency } = await import("./tools.js");
      const result = setMapTransparency(_getViewport(), transparency);
      return { content: [{ type: "text", text: JSON.stringify(result) }] };
    } catch (e: any) {
      return { content: [{ type: "text", text: JSON.stringify({ action: "set_map_transparency", transparency }) }] };
    }
  },
);

// ── 5. toggle_terrain ────────────────────────────────────────────────────────

server.tool(
  "toggle_terrain",
  "Toggles terrain display on or off. If 'enabled' is provided, sets it to that state; otherwise toggles.",
  {
    enabled: z.boolean().optional().describe("If provided, force terrain to this state (true = on, false = off). Omit to toggle."),
  },
  async ({ enabled }) => {
    try {
      const { toggleTerrain } = await import("./tools.js");
      const result = toggleTerrain(_getViewport(), enabled);
      return { content: [{ type: "text", text: JSON.stringify(result) }] };
    } catch (e: any) {
      return { content: [{ type: "text", text: JSON.stringify({ action: "toggle_terrain", enabled }) }] };
    }
  },
);

// ── 6. get_map_layer_info ────────────────────────────────────────────────────

server.tool(
  "get_map_layer_info",
  "Returns detailed information about all attached map layers (background and overlay) and whether the background map is enabled.",
  {},
  async () => {
    try {
      const { getMapLayerInfo } = await import("./tools.js");
      const result = getMapLayerInfo(_getViewport());
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    } catch (e: any) {
      return { content: [{ type: "text", text: JSON.stringify({ action: "get_map_layer_info" }) }] };
    }
  },
);

// ── 7. attach_map_layer ──────────────────────────────────────────────────────

server.tool(
  "attach_map_layer",
  "Attaches a new map layer to the viewport by URL. Supports WMS, WMTS, ArcGIS, ArcGISFeature, and TileURL formats.",
  {
    url: z.string().describe("The map layer service URL."),
    name: z.string().describe("Display name for the layer."),
    formatId: z
      .enum(["WMS", "WMTS", "ArcGIS", "ArcGISFeature", "TileURL"])
      .optional()
      .describe("The map service format. Defaults to 'WMS'."),
    isOverlay: z.boolean().optional().describe("If true, attach as overlay; otherwise as background layer. Default: false."),
    userName: z.string().optional().describe("Optional username for authenticated layers."),
    password: z.string().optional().describe("Optional password for authenticated layers."),
  },
  async ({ url, name, formatId, isOverlay, userName, password }) => {
    try {
      const { attachMapLayer } = await import("./tools.js");
      const result = await attachMapLayer(_getViewport(), url, name, formatId, isOverlay, userName, password);
      return { content: [{ type: "text", text: JSON.stringify(result) }] };
    } catch (e: any) {
      return {
        content: [{ type: "text", text: JSON.stringify({ action: "attach_map_layer", url, name, formatId, isOverlay, error: e.message }) }],
      };
    }
  },
);

// ── 8. detach_map_layer ──────────────────────────────────────────────────────

server.tool(
  "detach_map_layer",
  "Detaches (removes) a map layer by name. If multiple layers share the same name, all are removed.",
  {
    name: z.string().describe("The name of the map layer to detach."),
    isOverlay: z.boolean().optional().describe("If specified, only detach from overlay or background layers. Omit to search both."),
  },
  async ({ name, isOverlay }) => {
    try {
      const { detachMapLayer } = await import("./tools.js");
      const result = detachMapLayer(_getViewport(), name, isOverlay);
      return { content: [{ type: "text", text: JSON.stringify(result) }] };
    } catch (e: any) {
      return {
        content: [{ type: "text", text: JSON.stringify({ action: "detach_map_layer", name, isOverlay, error: e.message }) }],
      };
    }
  },
);

// ── 9. set_map_layer_visibility ──────────────────────────────────────────────

server.tool(
  "set_map_layer_visibility",
  "Sets the visibility of a specific map layer identified by name.",
  {
    name: z.string().describe("The name of the map layer to update."),
    visible: z.boolean().describe("Whether the layer should be visible."),
    isOverlay: z.boolean().optional().describe("If specified, only search overlay or background layers. Omit to search both."),
  },
  async ({ name, visible, isOverlay }) => {
    try {
      const { setMapLayerVisibility } = await import("./tools.js");
      const result = setMapLayerVisibility(_getViewport(), name, visible, isOverlay);
      return { content: [{ type: "text", text: JSON.stringify(result) }] };
    } catch (e: any) {
      return {
        content: [{ type: "text", text: JSON.stringify({ action: "set_map_layer_visibility", name, visible, isOverlay, error: e.message }) }],
      };
    }
  },
);

// ---------------------------------------------------------------------------
// Start
// ---------------------------------------------------------------------------

/** Start the MCP server on a stdio transport. */
export async function startServer() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Map Layers MCP server running on stdio");
}
