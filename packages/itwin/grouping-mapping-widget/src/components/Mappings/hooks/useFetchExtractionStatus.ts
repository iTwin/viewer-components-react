/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import type { ExtractionStatus, IExtractionClient } from "@itwin/insights-client";
import { ExtractionState } from "@itwin/insights-client";
import { useQuery } from "@tanstack/react-query";
import type { GetAccessTokenFn } from "../../context/GroupingApiConfigContext";
import type { ExtractionMessageData } from "../Extraction/ExtractionMessageModal";
import type { ExtractionStatusData } from "../Extraction/ExtractionStatusIcon";

export const useFetchExtractionStatus = ({
  iModelId,
  getAccessToken,
  extractionClient,
}: {
  iModelId: string;
  getAccessToken: GetAccessTokenFn;
  extractionClient: IExtractionClient;
}) => {
  return useQuery({
    queryKey: ["iModelExtractionStatus", iModelId],
    staleTime: Infinity,
    placeholderData: undefined,
    queryFn: async () => {
      const accessToken = await getAccessToken();
      const extraction = extractionClient.getIModelExtractionsIterator(accessToken, iModelId, 1);
      const latestExtractionResult = await extraction.next();

      let extractionStatusIcon: ExtractionStatusData;
      let extractionMessageData: ExtractionMessageData[] = [];

      const latestExtractionResultId = latestExtractionResult.value?.id;
      let latestJobStatus: ExtractionStatus|undefined;
      if (latestExtractionResultId) {
        latestJobStatus = latestExtractionResult.value;
      }

      if (latestExtractionResult.done) {
        extractionStatusIcon = {
          iconStatus: "negative",
          iconMessage: "No extraction found.",
        };
      } else {
        if (latestJobStatus?.state === ExtractionState.PartiallySucceeded || latestJobStatus?.state === ExtractionState.Failed) {
          const logs = await extractionClient.getExtractionLogs(accessToken, latestExtractionResultId);
          extractionMessageData = logs.logs.filter((log) => log.message !== null).map((log) => ({
            date: log.dateTime,
            category: log.category,
            level: log.level,
            message: log.message ?? "",
          }));
          extractionStatusIcon = {
            iconStatus: "negative",
            iconMessage: "Extraction contains issues. Click to view extraction logs.",
          };
        } else {
          extractionStatusIcon = {
            iconStatus: "positive",
            iconMessage: "Extraction successful.",
          };
        }
      }

      return { extractionStatusIcon, extractionMessageData, latestExtractionResult};
    },
  });
};
