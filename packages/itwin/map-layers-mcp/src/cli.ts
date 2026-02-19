#!/usr/bin/env node
/*---------------------------------------------------------------------------------------------
 * Map Layers MCP Server — CLI entry point
 *
 * Starts the MCP server with a stdio transport. This file is the entry point
 * for standalone (subprocess) usage. It is NOT imported by the library barrel
 * (index.ts), so importing @itwin/map-layers-mcp will not trigger a server.
 *
 * Usage:
 *   node dist/cli.js
 *--------------------------------------------------------------------------------------------*/

import { startServer } from "./server.js";

startServer().catch((err) => {
  console.error("Fatal error starting MCP server:", err);
  process.exit(1);
});
