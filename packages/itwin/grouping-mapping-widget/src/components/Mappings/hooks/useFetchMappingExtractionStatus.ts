/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import type { QueryClient } from "@tanstack/react-query";
import { useQuery } from "@tanstack/react-query";
import type { IExtractionClient } from "@itwin/insights-client";
import { ExtractorState } from "@itwin/insights-client";
import type { Mapping } from "@itwin/insights-client";
import { STATUS_CHECK_INTERVAL } from "../../Constants";
import { ExtractionStates } from "../Extraction/ExtractionStatus";
import type { GetAccessTokenFn } from "../../context/GroupingApiConfigContext";
import { useExtractionClient } from "../../context/ExtractionClientContext";
import { useMemo } from "react";
import { useExtractionStateJobContext } from "../../context/ExtractionStateJobContext";

export interface MappingExtractionStatusProps {
  getAccessToken: GetAccessTokenFn;
  mapping: Mapping;
  enabled: boolean;
}

export interface MappingQueryResults {
  mappingId: string;
  finalExtractionStateValue: ExtractionStates;
}[];

export const fetchMappingStatus = async (
  mappingId: string,
  jobId: string,
  getAccessToken: GetAccessTokenFn,
  extractionClient: IExtractionClient,
) => {
  const accessToken = await getAccessToken();

  if(jobId === ""){
    return { mappingId, finalExtractionStateValue: ExtractionStates.None };
  }
  const extractionStatusResponse = await extractionClient.getExtractionStatus(accessToken, jobId);

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
};

export const createQueryExtractionStatus = (mappingId: string, jobId: string, getAccessToken: GetAccessTokenFn, extractionClient: IExtractionClient, enabled: boolean) => ({
  queryKey: ["extractionState", mappingId],
  staleTime: Infinity,
  initialData: undefined,
  queryFn: async () => fetchMappingStatus(mappingId, jobId, getAccessToken, extractionClient),
  enabled,
  refetchInterval: STATUS_CHECK_INTERVAL,
});

export const resetMappingExtractionStatus = async (mappingId: string, queryClient: QueryClient) => {
  await queryClient.invalidateQueries({queryKey: ["extractionState", mappingId]});
};

export const useFetchMappingExtractionStatus = ({
  getAccessToken,
  mapping,
  enabled,
}: MappingExtractionStatusProps) => {
  const extractionClient = useExtractionClient();
  const { mappingIdJobInfo } = useExtractionStateJobContext();
  const jobId = mappingIdJobInfo.get(mapping.id) ?? "";

  const mappingQuery = useMemo(() => createQueryExtractionStatus(mapping.id, jobId, getAccessToken, extractionClient, enabled)
    // Not trigger hook everytime user (de)selects a mapping.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    , [getAccessToken, enabled, extractionClient, mappingIdJobInfo]);

  const statusQuery = useQuery<MappingQueryResults>(mappingQuery);

  return { statusQuery };
};
