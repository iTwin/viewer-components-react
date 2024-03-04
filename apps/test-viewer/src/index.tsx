/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import "./index.scss";
import "@itwin/itwinui-react/styles.css";
import React from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { ThemeProvider } from "@itwin/itwinui-react";
import { App } from "./components/App";

// Set custom global variables
if (process.env.IMJS_GLOBAL_PROPS) {
  try {
    const json = JSON.parse(process.env.IMJS_GLOBAL_PROPS);
    Object.entries(json).forEach(([key, value]) => {
      Object.defineProperty(globalThis, key, { value });
    });
  } catch {
    console.log(`Could not read 'IMJS_GLOBAL_PROPS'`);
  }
}
if (process.env.IMJS_URL_PREFIX) {
  globalThis.IMJS_URL_PREFIX = process.env.IMJS_URL_PREFIX;
}

if (!process.env.IMJS_AUTH_CLIENT_CLIENT_ID) {
  throw new Error("Please add a valid OIDC client id to the .env file and restart the application. See the README for more information.");
}
if (!process.env.IMJS_AUTH_CLIENT_SCOPES) {
  throw new Error("Please add valid scopes for your OIDC client to the .env file and restart the application. See the README for more information.");
}
if (!process.env.IMJS_AUTH_CLIENT_REDIRECT_URI) {
  throw new Error("Please add a valid redirect URI to the .env file and restart the application. See the README for more information.");
}

const root = createRoot(document.getElementById("root")!);
root.render(
  <React.StrictMode>
    <BrowserRouter>
      <ThemeProvider theme="light">
        <App />
      </ThemeProvider>
    </BrowserRouter>
  </React.StrictMode>,
);
