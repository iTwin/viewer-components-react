/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import "./index.scss";
import "@itwin/itwinui-react/styles.css";
import React from "react";
import { createRoot } from "react-dom/client";
import { App } from "./components/App";

// Set custom global variables
if (import.meta.env.IMJS_GLOBAL_PROPS) {
  try {
    const json = JSON.parse(import.meta.env.IMJS_GLOBAL_PROPS);
    Object.entries(json).forEach(([key, value]) => {
      Object.defineProperty(globalThis, key, { value });
    });
  } catch {
    console.log(`Could not read 'IMJS_GLOBAL_PROPS'`);
  }
}

if (import.meta.env.IMJS_URL_PREFIX) {
  globalThis.IMJS_URL_PREFIX = import.meta.env.IMJS_URL_PREFIX;
}

const root = createRoot(document.getElementById("root")!);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
