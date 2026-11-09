/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
/* eslint-disable no-console */

import { getTestAccessToken } from "@itwin/oidc-signin-tool";
import { test as setup } from "@playwright/test";

setup("authenticate", async ({ page }) => {
  if (!process.env.IMJS_USER_EMAIL || !process.env.IMJS_USER_PASSWORD) {
    throw new Error(`User credentials need to be supplied through IMJS_USER_EMAIL and IMJS_USER_PASSWORD environment variables.`);
  }
  if (!process.env.IMJS_AUTH_CLIENT_CLIENT_ID) {
    throw new Error(`Auth client id needs to be supplied through IMJS_AUTH_CLIENT_CLIENT_ID environment variable.`);
  }
  const accessToken = await getTestAccessToken(
    {
      authority: "https://qa-ims.bentley.com",
      scope: "itwin-platform",
      clientId: process.env.IMJS_AUTH_CLIENT_CLIENT_ID,
      redirectUri: "http://localhost:3000/signin-callback",
    },
    {
      email: process.env.IMJS_USER_EMAIL,
      password: process.env.IMJS_USER_PASSWORD,
    },
  );
  await page.context().addCookies([
    {
      name: "IMJS_USER_ACCESS_TOKEN",
      value: accessToken ?? "",
      domain: "localhost",
      path: "/",
    },
  ]);
  await page.context().storageState({ path: "e2e-out/.auth.json" });
  console.log(`Added an IMJS_USER_ACCESS_TOKEN cookie`);
});
