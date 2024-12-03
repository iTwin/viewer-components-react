/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
const crossEnv = require("cross-env");
const dotEnv = require("dotenv");

const path = require("path").resolve(__dirname, "../../../../apps/test-viewer");
const watch = process.argv[2] && process.argv[2] === "--watch";
const scriptName = watch ? "start:dev" : "start:dev:no-watch";
const options = process.platform === "win32" ? undefined : { shell: "/bin/sh" };

const env = {};
if (process.env.IS_PW) {
  // We know we're running e2e tests using `IS_PW` env var as it's set through playwright config.
  // The config also supplies some env variables specific to our e2e tests - QA prefixes, iTwinId,
  // iModelId. Here, we additionally load secrets required to access the iModel: OIDC client ID
  // and user credentials.
  dotEnv.config({ path: "./.env.e2e", processEnv: env });
}

crossEnv(
  [
    ...Object.entries(env)
      .filter(([key]) => !(key in process.env))
      .map(([key, value]) => `${key}=${JSON.stringify(value)}`),
    `npm run ${scriptName} --prefix ${path}`,
  ],
  options,
);
