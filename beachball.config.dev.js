/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
const base = require("./beachball.config.js");

/** @type {import("beachball").BeachballConfig } */
module.exports = {
  ...base,
  scope: [],
  tag: "nightly",
  prereleasePrefix: "dev",
  generateChangelog: false,
};
