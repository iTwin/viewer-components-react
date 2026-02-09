/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
// WARNING: The order of imports in this file is important!

// get rid of various xhr errors in the console

import globalJsdom from "global-jsdom";
import * as jsdom from "jsdom";

globalJsdom(undefined, {
  virtualConsole: new jsdom.VirtualConsole().forwardTo(console, { jsdomErrors: "none" }),
});
