/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import type { IPropertiesClient } from "@itwin/insights-client";
import { useQuery } from "@tanstack/react-query";
import type { GetAccessTokenFn } from "../../context/GroupingApiConfigContext";

export const useGroupPropertiesQuery = (iModelId: string, mappingId: string, groupId: string, getAccessToken: GetAccessTokenFn, propertiesClient: IPropertiesClient) => {
  return useQuery({
    queryKey: ["groupProperties", iModelId, mappingId, groupId],
    queryFn:  async () => propertiesClient.getProperties(await getAccessToken(), mappingId, groupId),
  });
};
