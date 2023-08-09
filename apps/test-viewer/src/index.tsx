/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import "./index.scss";
import React from "react";
import ReactDOM from "react-dom";
import { BrowserRouter } from "react-router-dom";
import { App } from "./components/App";

// Set custom global variables
if (process.env.IMJS_GLOBAL_PROPS) {
  try {
    const json = JSON.parse(process.env.IMJS_GLOBAL_PROPS);
    Object.entries(json).forEach(([key, value]) => { Object.defineProperty(globalThis, key, { value }) });
  } catch {
    console.log(`Could not read 'IMJS_GLOBAL_PROPS'`);
  }
}

if (!process.env.IMJS_AUTH_CLIENT_CLIENT_ID && !process.env.IMJS_DEMO_CLIENT) {
  throw new Error(
    "Please add a valid OIDC client id (or use demo client) to the .env file and restart the application. See the README for more information."
  );
}
if (!process.env.IMJS_AUTH_CLIENT_SCOPES) {
  throw new Error(
    "Please add valid scopes for your OIDC client to the .env file and restart the application. See the README for more information."
  );
}
if (!process.env.IMJS_AUTH_CLIENT_REDIRECT_URI) {
  throw new Error(
    "Please add a valid redirect URI to the .env file and restart the application. See the README for more information."
  );
}

ReactDOM.render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>,
  document.getElementById("root")
);
