/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import type { IOdataClient } from "@itwin/insights-client";
import { ODataClient } from "@itwin/insights-client";
import { createContext, useContext } from "react";

export const createODataClient = (url: string) => {
  return new ODataClient(url);
};

export const ODataClientContext = createContext<IOdataClient>(createODataClient(""));

export const useODataClient = () => {
  const context = useContext(ODataClientContext);
  if (!context) {
    throw new Error(
      "useODataClient should be used within a ODataClientContext provider"
    );
  }
  return context;
};
