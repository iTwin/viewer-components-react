/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
const { execSync } = require("child_process");

const playwrightTestArgs = [];
if (!process.env.CI) {
  playwrightTestArgs.push("--update-snapshots");
}

execSync(`playwright test ${playwrightTestArgs.join(" ")}`, { stdio: "inherit" });
