/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { useExtractionClient } from "../../context/ExtractionClientContext";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { GroupingMappingApiConfig } from "../../context/GroupingApiConfigContext";
import type { ExtractionRequestMapping, ExtractionRunRequest, Mapping } from "@itwin/insights-client";
import { useCallback, useState } from "react";
import { useExtractionStateJobContext } from "../../context/ExtractionStateJobContext";
import { ExtractionStates } from "../Extraction/ExtractionStatus";

export interface FetchExtractionStatesProps extends GroupingMappingApiConfig {
  jobId?: string;
}

export const useRunExtraction = ({
  iModelId,
  getAccessToken,
}: FetchExtractionStatesProps) => {

  const extractionClient = useExtractionClient();
  const [isJobStarted, setIsJobStarted] = useState<boolean>(false);
  const [isJobDone, setIsJobDone] = useState<boolean>(false);
  const { mappingIdJobInfo, setMappingIdJobInfo } = useExtractionStateJobContext();
  const queryClient = useQueryClient();

  const setInitialMappingExtractionQueryData = useCallback((mapping: Mapping) => {
    queryClient.setQueryData(["extractionState", mapping.id], {mappingId: mapping.id, finalExtractionStateValue: ExtractionStates.Starting});
  }, [queryClient]);

  const { mutateAsync: runExtraction, isLoading: isRunExtractionLoading } = useMutation({
    mutationKey: ["runExtraction"],
    mutationFn: async (mappings: Mapping[]) => {
      const accessToken = await getAccessToken();
      const mappingIds: ExtractionRequestMapping[] = mappings.length > 0 ? mappings.map((mapping) => { return { id: mapping.id }; }) : [];
      const extractionRequest: ExtractionRunRequest | undefined = {
        mappings: mappingIds,
      };
      const runExtractionResponse = await extractionClient.runExtraction(accessToken, iModelId, extractionRequest);
      for (const mapping of mappings){
        if(mappingIdJobInfo?.get(mapping.id) === undefined){
          setInitialMappingExtractionQueryData(mapping);
          setMappingIdJobInfo((prevMap: Map<string, string>) => {
            const newMap = new Map(prevMap);
            newMap.set(mapping.id, runExtractionResponse.id);
            return newMap;
          });
        }
      }
    },
  });

  return { isRunExtractionLoading, isJobStarted, isJobDone, setIsJobDone, setIsJobStarted, runExtraction };
};
