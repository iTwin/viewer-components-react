/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import "./index.scss";
import React from "react";
import ReactDOM from "react-dom";
import { BrowserRouter } from "react-router-dom";
import { App } from "./components/App";

if (!process.env.IMJS_AUTH_CLIENT_CLIENT_ID) {
  throw new Error(
    "Please add a valid OIDC client id to the .env file and restart the application. See the README for more information."
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
