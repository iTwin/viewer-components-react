#!/usr/bin/env node
/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

/**
 * Map Layers MCP Server — CLI entry point
 *
 * Starts the MCP server with a stdio transport. This file is the entry point
 * for standalone (subprocess) usage. It is NOT imported by the library barrel,
 * so importing `@itwin/map-layers` or `@itwin/map-layers/mcp` will not
 * trigger a server.
 *
 * Usage:
 *   node lib/cjs/mcp/cli.js
 */

import { startServer } from "./server";

startServer().catch((err: unknown) => {
  console.error("Fatal error starting MCP server:", err);
   
  throw err;
});
