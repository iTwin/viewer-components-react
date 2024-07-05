/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
import { GetAccessTokenFn } from "@itwin/grouping-mapping-widget";
import type { IPropertiesClient } from "@itwin/insights-client";
import { useQuery } from "@tanstack/react-query";

export const usePropertiesQuery = (
  iModelId: string,
  mappingId: string,
  groupId: string,
  getAccessToken: GetAccessTokenFn,
  propertiesClient: IPropertiesClient,
) => {
  return useQuery({
    queryKey: ["properties", iModelId, mappingId, groupId],
    queryFn: async () => propertiesClient.getProperties(await getAccessToken(), mappingId, groupId),
  });
};
