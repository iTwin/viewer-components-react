/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
import type { IModelsClientOptions } from "@itwin/imodels-client-management";
import { IModelsClient } from "@itwin/imodels-client-management";
import { createContext, useContext } from "react";
import type { ClientPrefix } from "./GroupingApiConfigContext";

const baseUrl: string = "https://api.bentley.com/imodels";

const prefixUrl = (baseUrl?: string, prefix?: string) => {
  if (prefix && baseUrl) {
    return baseUrl.replace("api.bentley.com", `${prefix}-api.bentley.com`);
  }
  return baseUrl;
};

export const createIModelsClient = (prefix?: ClientPrefix): IModelsClient => {
  const url = prefixUrl(baseUrl, prefix);
  const options: IModelsClientOptions = {
    api: {
      baseUrl: url,
    },
  };
  return new IModelsClient(options);
};

export const IModelsClientContext = createContext<IModelsClient>(createIModelsClient());

export const useIModelsClient = () => {
  const context = useContext(IModelsClientContext);
  if (!context) {
    throw new Error("useIModelsClient should be used within an IModelsClientContext provider");
  }
  return context;
};
