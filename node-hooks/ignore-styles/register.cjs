/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

const { register } = require("node:module");
const { pathToFileURL } = require("node:url");

register("./hook.cjs", pathToFileURL(__filename));
