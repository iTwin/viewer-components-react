/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import type { IGroupsClient } from "@itwin/insights-client";
import { GROUPING_AND_MAPPING_BASE_PATH, GroupsClient } from "@itwin/insights-client";
import { createContext, useContext } from "react";
import type { ClientPrefix } from "./GroupingApiConfigContext";

const prefixUrl = (baseUrl?: string, prefix?: string) => {
  if (prefix && baseUrl) {
    return baseUrl.replace("api.bentley.com", `${prefix}-api.bentley.com`);
  }
  return baseUrl;
};

/**
 * @internal
 */
export const createDefaultGroupsClient = (prefix?: ClientPrefix): IGroupsClient => {
  const url = prefixUrl(GROUPING_AND_MAPPING_BASE_PATH, prefix);
  return new GroupsClient(undefined, url);
};

/**
 * @internal
 */
export const createGroupsClient = (clientProp: IGroupsClient | ClientPrefix) => {
  if (undefined === clientProp || typeof clientProp === "string") {
    return createDefaultGroupsClient(clientProp as ClientPrefix);
  }
  return clientProp;
};

/**
 * @internal
 */
export const GroupsClientContext = createContext<IGroupsClient>(createDefaultGroupsClient());

/**
 * @internal
 */
export const useGroupsClient = () => {
  const context = useContext(GroupsClientContext);
  if (!context) {
    throw new Error(
      "useGroupsClient should be used within a GroupsClientContext provider"
    );
  }
  return context;
};
