/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { createContext, useContext } from "react";
import { BASE_PATH } from "../EC3ConfigurationClient";
import { EC3JobClient } from "../EC3JobClient";

const prefixUrl = (prefix: string) => {
  return BASE_PATH.replace("api.bentley.com", `${prefix}-api.bentley.com`);
};

export const createDefaultEC3JobClient = (prefix?: string): EC3JobClient => {
  const url = prefixUrl(prefix ?? "");
  return new EC3JobClient(url);
};

export const createEC3JobClient = (prefix?: string) => {
  return createDefaultEC3JobClient(prefix);
};

export const EC3JobClientContext = createContext<EC3JobClient>(createDefaultEC3JobClient());

export const useEC3JobClient = () => {
  const context = useContext(EC3JobClientContext);
  if (!context) {
    throw new Error(
      "useEC3JobClient should be used within a EC3JobClientContext provider"
    );
  }
  return context;
};
