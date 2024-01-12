/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { useExtractionClient } from "../../context/ExtractionClientContext";
import { ExtractorState } from "@itwin/insights-client";
import { useQuery, useMutation } from "@tanstack/react-query";
import { GroupingMappingApiConfig } from "../../context/GroupingApiConfigContext";
import type { ExtractionRequestMapping, ExtractionRunRequest, Mapping } from "@itwin/insights-client";
import { useState } from "react";
import { ExtractionStates } from "../Extraction/ExtractionStatus";
import { STATUS_CHECK_INTERVAL } from "../../Constants";

export const useFetchExtractionStates = ({
  iModelId,
  getAccessToken
}: GroupingMappingApiConfig) => {

  const extractionClient = useExtractionClient();
  const [isJobStarted, setIsJobStarted] = useState<boolean>(false);
  const [isJobDone, setIsJobDone] = useState<boolean>(false);

  const { mutateAsync: runExtraction } = useMutation({
    mutationKey: ["runExtraction"],
    mutationFn: async (mappings: Mapping[]) => {
      const accessToken = await getAccessToken();
      const mappingIds: ExtractionRequestMapping[] = mappings.length > 0 ? mappings.map((mapping) => { return { id: mapping.id } }) : [];
      const extractionRequest: ExtractionRunRequest | undefined = {
        mappings: mappingIds,
      };
      await extractionClient.runExtraction(accessToken, iModelId, extractionRequest);
    },
  });

  const { data: extractionStateData, isError: isExtractionStateError, isLoading: isExtractionStatusLoading } = useQuery({
    queryKey: ["extractionState"],
    staleTime: Infinity,
    placeholderData: undefined,
    queryFn: async () => {
      const accessToken = await getAccessToken();
      const extractionHistoryIterator = extractionClient.getExtractionHistoryIterator(accessToken, iModelId, 1);
      const extractionHistoryResult = await extractionHistoryIterator.next();
      const jobId = extractionHistoryResult.value.jobId;
      const extractionStatusResponse = await extractionClient.getExtractionStatus(accessToken, jobId);

      if (extractionStatusResponse.state === ExtractorState.Failed || extractionStatusResponse.state === ExtractorState.Succeeded) {
        setIsJobStarted(false);
        setIsJobDone(true);
      }
      return await finalExtractionState(extractionStatusResponse.state);
    },
    enabled: isJobStarted,
    refetchInterval: STATUS_CHECK_INTERVAL,
  });

  const finalExtractionState = async (state: ExtractorState | undefined) => {
    if (state === undefined)
      return ExtractionStates.None;

    if (state === ExtractorState.Failed || isExtractionStateError)
      return ExtractionStates.Queued;

    if (state === ExtractorState.Queued)
      return ExtractionStates.Queued;

    if (state === ExtractorState.Running)
      return ExtractionStates.Running;

    if (state === ExtractorState.Succeeded)
      return ExtractionStates.Succeeded;

    return ExtractionStates.Failed;
  };

  return { extractionStateData, isExtractionStatusLoading, isJobStarted, isJobDone, setIsJobDone, setIsJobStarted, runExtraction };
};
