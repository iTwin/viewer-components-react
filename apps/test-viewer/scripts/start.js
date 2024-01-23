/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
const crossEnv = require("cross-env");
const dotEnv = require("dotenv");
const { TestBrowserAuthorizationClient } = require("@itwin/oidc-signin-tool");

// set default values for auth client
const env = {
  IMJS_AUTH_CLIENT_REDIRECT_URI: "http://localhost:3000/signin-callback",
  IMJS_AUTH_CLIENT_LOGOUT_URI: "http://localhost:3000",
  IMJS_AUTH_CLIENT_SCOPES: "imodelaccess:read imodels:read realitydata:read",
};
// supplement with values in `.env`, override if necessary
dotEnv.config({ override: true, processEnv: env });
// place into `process.env`
Object.entries(env).forEach(([key, value]) => {
  if (!(key in process.env)) {
    process.env[key] = value;
  }
});

// there's no way to auto-login the user using env credentials in the app itself, so we
// have to do that here and pass access token to the app
async function getAccessToken() {
  if (process.env.IMJS_USER_EMAIL && process.env.IMJS_USER_PASSWORD) {
    const client = new TestBrowserAuthorizationClient(
      {
        scope: process.env.IMJS_AUTH_CLIENT_SCOPES ?? "",
        clientId: process.env.IMJS_AUTH_CLIENT_CLIENT_ID ?? "",
        redirectUri: process.env.IMJS_AUTH_CLIENT_REDIRECT_URI ?? "",
        authority: process.env.IMJS_AUTH_AUTHORITY,
      },
      {
        email: process.env.IMJS_USER_EMAIL,
        password: process.env.IMJS_USER_PASSWORD,
      },
    );
    const accessToken = await client.getAccessToken();
    if (!accessToken) {
      throw new Error(`User ${process.env.IMJS_USER_EMAIL} failed to signed-in.`);
    }
    console.log(`User ${process.env.IMJS_USER_EMAIL} successfully signed-in.`);
    return accessToken;
  }
  console.log(`User for test viewer is not configured`);
  return undefined;
}

async function main() {
  const accessToken = await getAccessToken();
  const options = process.platform === "win32" ? undefined : { shell: "/bin/sh" };
  crossEnv([...(accessToken ? [`IMJS_USER_ACCESS_TOKEN=${accessToken}`] : []), `react-scripts`, `--max_old_space_size=4096`, `start`], options);
}

main();
