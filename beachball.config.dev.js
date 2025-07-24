/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
const base = require("./beachball.config.js");

/** @type {import("beachball").BeachballConfig } */
module.exports = {
  ...base,
  scope: [], // List package paths to include in the dev release ie: "packages/itwin/map-layers"
  tag: "dev",
  prereleasePrefix: "dev",
  generateChangelog: false,
};
