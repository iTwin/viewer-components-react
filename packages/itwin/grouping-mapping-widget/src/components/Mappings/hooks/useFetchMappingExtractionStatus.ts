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
import { useMemo } from "react";
import { useExtractionStateJobContext } from "../../context/ExtractionStateJobContext";

export interface MappingExtractionStatusProps extends GroupingMappingApiConfig {
  isMounted: boolean;
  mapping: Mapping;
  enabled: boolean;
}

export interface MappingQueryResults {
  mappingId: string;
  finalExtractionStateValue: ExtractionStates;
}[];

export const fetchMappingStatus = async (
  isMounted: boolean,
  mappingId: string,
  jobId: string,
  getAccessToken: GetAccessTokenFn,
  iModelId: string,
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

  if(isMounted){
    const iModelExtraction = extractionClient.getExtractionHistoryIterator(accessToken, iModelId, 1);
    const latestExtractionResult = await iModelExtraction.next();
    const iModelJobId = latestExtractionResult.value.jobId;
    const response = await extractionClient.getExtractionStatus(accessToken, iModelJobId);
    return getFinalExtractionStatus(response);
  } else {
    if(jobId === ""){
      return {mappingId, finalExtractionStateValue: ExtractionStates.None};
    }
    const extractionStatusResponse = await extractionClient.getExtractionStatus(accessToken, jobId);
    return getFinalExtractionStatus(extractionStatusResponse);
  }
};

export const createQueryExtractionStatus = (isMounted: boolean, mappingId: string, jobId: string, getAccessToken: GetAccessTokenFn, iModelId: string, extractionClient: IExtractionClient, enabled: boolean) => ({
  queryKey: ["extractionState", mappingId],
  staleTime: Infinity,
  initialData: undefined,
  queryFn: async () => fetchMappingStatus(isMounted, mappingId, jobId, getAccessToken, iModelId, extractionClient),
  enabled,
  refetchInterval: STATUS_CHECK_INTERVAL,
});

export const resetMappingExtractionStatus = async (mappingId: string, queryClient: QueryClient) => {
  await queryClient.invalidateQueries({queryKey: ["extractionState", mappingId]});
};

export const useFetchMappingExtractionStatus = ({
  isMounted,
  iModelId,
  getAccessToken,
  mapping,
  enabled,
}: MappingExtractionStatusProps) => {
  const extractionClient = useExtractionClient();
  const { mappingIdJobInfo } = useExtractionStateJobContext();
  const jobId = mappingIdJobInfo.get(mapping.id) ?? "";

  const mappingQuery = useMemo(() => createQueryExtractionStatus(isMounted, mapping.id, jobId, getAccessToken, iModelId, extractionClient, enabled)
    // Not trigger hook everytime user (de)selects a mapping.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    , [iModelId, getAccessToken, enabled, extractionClient, mappingIdJobInfo]);

  const statusQuery = useQuery<MappingQueryResults>(mappingQuery);

  return { statusQuery };
};
