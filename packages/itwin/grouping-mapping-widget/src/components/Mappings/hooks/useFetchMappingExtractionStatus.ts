/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import type { QueryClient } from "@tanstack/react-query";
import { useQuery } from "@tanstack/react-query";
import type { ExtractionStatus, IExtractionClient } from "@itwin/insights-client";
import { ExtractorState } from "@itwin/insights-client";
import type { Mapping } from "@itwin/insights-client";
import { STATUS_CHECK_INTERVAL } from "../../Constants";
import { ExtractionStates } from "../Extraction/ExtractionStatus";
import type { GetAccessTokenFn, GroupingMappingApiConfig } from "../../context/GroupingApiConfigContext";
import { useExtractionClient } from "../../context/ExtractionClientContext";
import { useExtractionStateJobContext } from "../../context/ExtractionStateJobContext";

export interface MappingExtractionStatusProps extends GroupingMappingApiConfig {
  mapping: Mapping;
  enabled: boolean;
}

export interface MappingQueryResult {
  mappingId: string;
  finalExtractionStateValue: ExtractionStates;
}

export const fetchMappingStatus = async (
  mappingId: string,
  jobId: string|undefined,
  getAccessToken: GetAccessTokenFn,
  extractionClient: IExtractionClient,
) => {
  const accessToken = await getAccessToken();

  const getFinalExtractionStatus = ((extractionStatusResponse: ExtractionStatus) => {
    switch(extractionStatusResponse.state) {
      case undefined:
        return { mappingId, finalExtractionStateValue: ExtractionStates.Starting};
      case ExtractorState.Running:
        return { mappingId, finalExtractionStateValue: ExtractionStates.Running};
      case ExtractorState.Failed:
        return { mappingId, finalExtractionStateValue: ExtractionStates.Failed};
      case ExtractorState.Queued:
        return { mappingId, finalExtractionStateValue: ExtractionStates.Queued};
      case ExtractorState.Succeeded:
        return { mappingId, finalExtractionStateValue: ExtractionStates.Succeeded};
      default:
        return { mappingId, finalExtractionStateValue: ExtractionStates.None};
    }
  });

  if(!jobId){
    return {mappingId, finalExtractionStateValue: ExtractionStates.None};
  }
  const extractionStatusResponse = await extractionClient.getExtractionStatus(accessToken, jobId);
  return getFinalExtractionStatus(extractionStatusResponse);
};

export const resetMappingExtractionStatus = async (queryClient: QueryClient) => {
  await queryClient.invalidateQueries({queryKey: ["extractionState"]});
};

export const useFetchMappingExtractionStatus = ({
  getAccessToken,
  mapping,
  enabled,
}: MappingExtractionStatusProps) => {
  const extractionClient = useExtractionClient();
  const { mappingIdJobInfo } = useExtractionStateJobContext();
  const jobId = mappingIdJobInfo.get(mapping.id);

  const statusQuery = useQuery<MappingQueryResult>({
    queryKey: ["extractionState", jobId],
    queryFn: async () => fetchMappingStatus(mapping.id, jobId, getAccessToken, extractionClient),
    enabled,
    refetchInterval: STATUS_CHECK_INTERVAL,
  });

  return statusQuery;
};
