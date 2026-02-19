/*---------------------------------------------------------------------------------------------
 * Viewport Accessor
 *
 * Shared module that holds the viewport accessor used by both the MCP server
 * and the in-process tool functions. This module has no side effects and is
 * safe to import from any context.
 *--------------------------------------------------------------------------------------------*/

// ---------------------------------------------------------------------------
// Viewport accessor
// ---------------------------------------------------------------------------
// The MCP server runs in its own process and cannot directly access the
// iTwin.js ScreenViewport.  The host application must provide a viewport
// accessor.  For stdio-based deployments the tools encode the *intent* and
// the host application applies them.  When running **in-process** (e.g. via
// an adapter) the host can set this accessor before starting the server.
//
// For the stdio transport case, each tool simply returns a structured JSON
// payload that the host can interpret and apply to its viewport.
// ---------------------------------------------------------------------------

type ViewportAccessor = () => /* ScreenViewport | undefined */ any;
let _getViewport: ViewportAccessor = () => undefined;

/** Set the viewport accessor (for in-process usage). */
export function setViewportAccessor(fn: ViewportAccessor) {
  _getViewport = fn;
}

/** Get the current viewport via the registered accessor. */
export function getViewportAccessor(): any {
  return _getViewport();
}
