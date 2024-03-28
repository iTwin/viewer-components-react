/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { useExtractionClient } from "../../context/ExtractionClientContext";
import { useMutation } from "@tanstack/react-query";
import type { GroupingMappingApiConfig } from "../../context/GroupingApiConfigContext";
import type { ExtractionMapping, ExtractionRequestDetails ,Mapping } from "@itwin/insights-client";
import { useState } from "react";
import { useExtractionStateJobContext } from "../../context/ExtractionStateJobContext";

export interface FetchExtractionStatesProps extends GroupingMappingApiConfig {
  jobId?: string;
}

export const useRunExtraction = ({
  iModelId,
  getAccessToken,
}: FetchExtractionStatesProps) => {
  const extractionClient = useExtractionClient();
  const [isJobStarted, setIsJobStarted] = useState<boolean>(false);
  const { mappingIdJobInfo, setMappingIdJobInfo } = useExtractionStateJobContext();

  const { mutateAsync: runExtraction, isLoading: isRunExtractionLoading, isSuccess: isRunExtractionSuccess } = useMutation({
    mutationKey: ["runExtraction"],
    mutationFn: async (mappings: Mapping[]) => {
      const accessToken = await getAccessToken();
      const mappingIds: ExtractionMapping[] = mappings.length > 0 ? mappings.map((mapping) => { return { id: mapping.id }; }) : [];
      const extractionRequest: ExtractionRequestDetails = {
        mappings: mappingIds,
        iModelId,
      };

      const runExtractionResponse = await extractionClient.runExtraction(accessToken, extractionRequest);
      return runExtractionResponse;
    },
    onSuccess: async (runExtractionResponse, mappings) => {
      for (const mapping of mappings){
        if(mappingIdJobInfo?.get(mapping.id) === undefined){
          setMappingIdJobInfo((prevMap: Map<string, string>) => {
            const newMap = new Map(prevMap);
            newMap.set(mapping.id, runExtractionResponse.id);
            return newMap;
          });
        }
      }
    },
  });

  return { isRunExtractionLoading, isRunExtractionSuccess, isJobStarted, setIsJobStarted, runExtraction };
};
