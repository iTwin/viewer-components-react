/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import type { IMappingsClient } from "@itwin/insights-client";
import { useQuery } from "@tanstack/react-query";
import type { GetAccessTokenFn } from "../../context/GroupingApiConfigContext";

export const fetchGroups = async (
  iModelId: string,
  mappingId: string,
  getAccessToken: GetAccessTokenFn,
  mappingsClient: IMappingsClient
)=> {
  const accessToken = await getAccessToken();
  const groups = await mappingsClient.getGroups(accessToken, iModelId, mappingId);
  return groups;
};

export const useFetchGroups = (iModelId: string, mappingId: string, getAccessToken: GetAccessTokenFn, mappingsClient: IMappingsClient) => {
  return useQuery({
    queryKey: ["groups", mappingId],
    queryFn:  async () => fetchGroups(iModelId, mappingId, getAccessToken, mappingsClient),
  });
};
