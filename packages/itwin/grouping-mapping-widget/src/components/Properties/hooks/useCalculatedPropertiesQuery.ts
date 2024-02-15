import type { IMappingsClient } from "@itwin/insights-client";
import { useQuery } from "@tanstack/react-query";
import type { GetAccessTokenFn } from "../../context/GroupingApiConfigContext";

export const useCalculatedPropertiesQuery = (iModelId: string, mappingId: string, groupId: string, getAccessToken: GetAccessTokenFn, mappingsClient: IMappingsClient) => {
  return useQuery({
    queryKey: ["calculatedProperties", mappingId, groupId],
    queryFn:  async () => mappingsClient.getCalculatedProperties(await getAccessToken(), iModelId, mappingId, groupId),
  });
};
