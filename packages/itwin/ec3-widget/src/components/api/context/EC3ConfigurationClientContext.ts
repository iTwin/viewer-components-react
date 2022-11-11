/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { createContext, useContext } from "react";
import { BASE_PATH } from "../EC3ConfigurationClient";
import { EC3ConfigurationClient } from "../EC3ConfigurationClient";

const prefixUrl = (prefix: string) => {
  return BASE_PATH.replace("api.bentley.com", `${prefix}-api.bentley.com`);
};

export const createDefaultEC3ConfigurationClient = (prefix?: string): EC3ConfigurationClient => {
  const url = prefixUrl(prefix ?? "");
  return new EC3ConfigurationClient(url);
};

export const createEC3ConfigurationClient = (prefix?: string) => {
  return createDefaultEC3ConfigurationClient(prefix);
};

export const EC3ConfigurationClientContext = createContext<EC3ConfigurationClient>(createDefaultEC3ConfigurationClient());

export const useEC3ConfigurationClient = () => {
  const context = useContext(EC3ConfigurationClientContext);
  if (!context) {
    throw new Error(
      "useEC3ConfigurationClient should be used within a EC3ConfigurationClientContext provider"
    );
  }
  return context;
};
