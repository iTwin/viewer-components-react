/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import type { IMappingsClient } from "@itwin/insights-client";
import { useQuery } from "@tanstack/react-query";
import type { GetAccessTokenFn } from "../../context/GroupingApiConfigContext";

export const useGroupPropertiesQuery = (iModelId: string, mappingId: string, groupId: string, getAccessToken: GetAccessTokenFn, mappingsClient: IMappingsClient) => {
  return useQuery({
    queryKey: ["groupProperties", iModelId, mappingId, groupId],
    queryFn:  async () => mappingsClient.getGroupProperties(await getAccessToken(), iModelId, mappingId, groupId),
  });
};
