/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
import type { QueryClient } from "@tanstack/react-query";
import { useQuery } from "@tanstack/react-query";
import type { ExtractionStatus, IExtractionClient } from "@itwin/insights-client";
import { ExtractionState } from "@itwin/insights-client";
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

export const fetchMappingStatus = async (mappingId: string, jobId: string, getAccessToken: GetAccessTokenFn, extractionClient: IExtractionClient) => {
  const accessToken = await getAccessToken();

  const getFinalExtractionStatus = (extractionStatusResponse: ExtractionStatus) => {
    switch (extractionStatusResponse.state) {
      case undefined:
        return { mappingId, finalExtractionStateValue: ExtractionStates.Starting };
      case ExtractionState.Running:
        return { mappingId, finalExtractionStateValue: ExtractionStates.Running };
      case ExtractionState.Failed:
        return { mappingId, finalExtractionStateValue: ExtractionStates.Failed };
      case ExtractionState.Queued:
        return { mappingId, finalExtractionStateValue: ExtractionStates.Queued };
      case ExtractionState.Succeeded:
      case ExtractionState.PartiallySucceeded:
        return { mappingId, finalExtractionStateValue: ExtractionStates.Succeeded };
      default:
        return { mappingId, finalExtractionStateValue: ExtractionStates.None };
    }
  };
  const extractionStatusResponse = await extractionClient.getExtractionStatus(accessToken, jobId);
  return getFinalExtractionStatus(extractionStatusResponse);
};

export const resetMappingExtractionStatus = async (queryClient: QueryClient) => {
  await queryClient.invalidateQueries({ queryKey: ["extractionState"] });
};

export const useFetchMappingExtractionStatus = ({ getAccessToken, mapping, enabled }: MappingExtractionStatusProps) => {
  const extractionClient = useExtractionClient();
  const { mappingIdJobInfo } = useExtractionStateJobContext();
  const jobId = mappingIdJobInfo.get(mapping.id);

  const statusQuery = useQuery<MappingQueryResult>({
    queryKey: ["extractionState", jobId],
    queryFn: async () => {
      if (jobId) {
        return fetchMappingStatus(mapping.id, jobId, getAccessToken, extractionClient);
      }
      // This should not happen as jobId should be defined if enabled is true
      throw new Error("Job ID is undefined");
    },
    enabled: enabled && Boolean(jobId), // Only enable the query if enabled is true and jobId is defined
    refetchInterval: STATUS_CHECK_INTERVAL,
  });

  return statusQuery;
};
