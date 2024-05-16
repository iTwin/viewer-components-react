/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import type { IMappingsClient } from "@itwin/insights-client";
import { useQuery } from "@tanstack/react-query";
import type { GetAccessTokenFn } from "../../context/GroupingApiConfigContext";

export const useFetchMappings = (iModelId: string, getAccessToken: GetAccessTokenFn, mappingsClient: IMappingsClient) =>
  useQuery({
    queryKey: ["mappings", iModelId],
    queryFn: async () => {
      const accessToken = await getAccessToken();
      const mappings = await mappingsClient.getMappings(accessToken, iModelId);
      return mappings.mappings.sort((a, b) => a.mappingName.localeCompare(b.mappingName));
    }});
