/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

/**
 * Shared viewport accessor used by both the MCP server and tool functions.
 * This module has no side effects and is safe to import from any context.
 */

import type { ScreenViewport } from "@itwin/core-frontend";

type ViewportAccessor = () => ScreenViewport | undefined;
let _getViewport: ViewportAccessor = () => undefined;

/** Set the viewport accessor so MCP tool functions can reach the live viewport. */
export function setViewportAccessor(fn: ViewportAccessor): void {
  _getViewport = fn;
}

/** Get the current viewport via the registered accessor. */
export function getViewportAccessor(): ScreenViewport | undefined {
  return _getViewport();
}
