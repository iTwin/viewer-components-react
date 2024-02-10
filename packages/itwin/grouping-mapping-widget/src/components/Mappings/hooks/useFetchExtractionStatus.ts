/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import type { IExtractionClient } from "@itwin/insights-client";
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
      const extraction = extractionClient.getExtractionHistoryIterator(accessToken, iModelId, 1);
      const latestExtractionResult = await extraction.next();

      let extractionStatusIcon: ExtractionStatusData;
      let extractionMessageData: ExtractionMessageData[] = [];

      if (latestExtractionResult.done) {
        extractionStatusIcon = {
          iconStatus: "negative",
          iconMessage: "No extraction found.",
        };
      } else {
        const jobId = latestExtractionResult.value.jobId;
        const status = await extractionClient.getExtractionStatus(accessToken, jobId);

        if (status.containsIssues) {
          const logs = await extractionClient.getExtractionLogs(accessToken, jobId);
          extractionMessageData = logs.filter((log) => log.message !== null).map((log) => ({
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

      return { extractionStatusIcon, extractionMessageData, latestExtractionResult };
    },
  });
};
