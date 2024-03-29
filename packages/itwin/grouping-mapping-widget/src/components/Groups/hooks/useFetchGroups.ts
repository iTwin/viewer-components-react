/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import type { IGroupsClient } from "@itwin/insights-client";
import { useQuery } from "@tanstack/react-query";
import type { GetAccessTokenFn } from "../../context/GroupingApiConfigContext";

export const fetchGroups = async (
  mappingId: string,
  getAccessToken: GetAccessTokenFn,
  groupsClient: IGroupsClient
)=> {
  const accessToken = await getAccessToken();
  const groupsList = await groupsClient.getGroups(accessToken, mappingId);
  return groupsList.groups;
};

export const useFetchGroups = (mappingId: string, getAccessToken: GetAccessTokenFn, groupsClient: IGroupsClient) => {
  return useQuery({
    queryKey: ["groups", mappingId],
    queryFn:  async () => fetchGroups(mappingId, getAccessToken, groupsClient),
  });
};
