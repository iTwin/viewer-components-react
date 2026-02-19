# @itwin/map-layers-mcp

MCP (Model Context Protocol) server that exposes iTwin.js map-layer operations as tools.

## Tools

| Tool | Description |
|------|-------------|
| `open_map_layers_widget` | Opens the Map Layers widget panel in the frontstage UI |
| `toggle_background_map` | Toggles the background map on/off |
| `set_base_map_type` | Changes the base map (aerial, hybrid, street, or solid color) |
| `set_map_transparency` | Sets background map transparency (0–1) |
| `toggle_terrain` | Toggles terrain display on/off |
| `get_map_layer_info` | Returns info about all attached map layers |
| `attach_map_layer` | Attaches a new map layer by URL (WMS, WMTS, ArcGIS, TileURL) |
| `detach_map_layer` | Detaches a map layer by name |
| `set_map_layer_visibility` | Sets visibility of a specific map layer |

## Usage

### As a stdio MCP server

```bash
npm run build
node dist/cli.js
```

Configure in your MCP client (e.g. VS Code `mcp.json`, Claude Desktop `claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "map-layers": {
      "command": "node",
      "args": ["path/to/packages/itwin/map-layers-mcp/dist/cli.js"]
    }
  }
}
```

### In-process (inside an iTwin.js app)

```typescript
import { setViewportAccessor } from "@itwin/map-layers-mcp";
import { IModelApp } from "@itwin/core-frontend";

// Provide the viewport accessor so tool functions can operate on the live viewport
setViewportAccessor(() => IModelApp.viewManager.selectedView);
```

## Architecture

The server uses the **MCP SDK** (`@modelcontextprotocol/sdk`) with a **stdio transport**.

- **`src/tools.ts`** — Pure functions that operate on an iTwin.js `ScreenViewport`. They use `any` types to avoid hard dependencies on `@itwin/core-frontend` / `@itwin/core-common` — the host app provides these at runtime.
- **`src/server.ts`** — MCP server that registers all 9 tools with zod schemas and wires them to the tool functions. Does **not** auto-start; call `startServer()` or use the CLI.
- **`src/viewport.ts`** — Shared viewport accessor module (no side effects).
- **`src/cli.ts`** — CLI entry point that starts the server on stdio.
- **`src/index.ts`** — Public API barrel for in-process usage.

When running standalone (stdio), the tool functions that need a viewport will return structured JSON payloads describing the intended action. The host iTwin.js application should use `setViewportAccessor()` to provide real viewport access.
