import type { IMappingsClient } from "@itwin/insights-client";
import { useQuery } from "@tanstack/react-query";
import type { GetAccessTokenFn } from "../../context/GroupingApiConfigContext";

export const useCustomCalculationsQuery = (iModelId: string, mappingId: string, groupId: string, getAccessToken: GetAccessTokenFn, mappingsClient: IMappingsClient) => {
  return useQuery({
    queryKey: ["customCalculations", mappingId, groupId],
    queryFn:  async () => mappingsClient.getCustomCalculations(await getAccessToken(), iModelId, mappingId, groupId),
  });
};