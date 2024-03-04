/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import type { IMappingsClient } from "@itwin/insights-client";
import { useQuery } from "@tanstack/react-query";
import type { GetAccessTokenFn } from "../../context/GroupingApiConfigContext";

export const useCustomCalculationsQuery = (iModelId: string, mappingId: string, groupId: string, getAccessToken: GetAccessTokenFn, mappingsClient: IMappingsClient) => {
  return useQuery({
    queryKey: ["customCalculations", iModelId, mappingId, groupId],
    queryFn:  async () => mappingsClient.getCustomCalculations(await getAccessToken(), iModelId, mappingId, groupId),
  });
};
