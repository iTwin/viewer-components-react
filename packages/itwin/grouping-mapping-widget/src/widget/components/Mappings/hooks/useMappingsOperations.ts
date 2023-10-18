/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { useCallback, useEffect, useState } from "react";
import {
  getErrorMessage,
} from "../../SharedComponents/utils";
import type { IExtractionClient, IMappingsClient, Mapping } from "@itwin/insights-client";
import type { GroupingMappingApiConfig } from "../../context/GroupingApiConfigContext";
import type { GetAccessTokenFn } from "../../context/GroupingApiConfigContext";
import { useExtractionClient } from "../../context/ExtractionClientContext";

const fetchMappings = async (
  setMappings: React.Dispatch<React.SetStateAction<Mapping[]>>,
  iModelId: string,
  setIsLoading: React.Dispatch<React.SetStateAction<boolean>>,
  getAccessToken: GetAccessTokenFn,
  mappingsClient: IMappingsClient,
  setErrorMessage: (message: string | undefined) => void
) => {
  try {
    setIsLoading(true);
    const accessToken = await getAccessToken();
    const mappings = await mappingsClient.getMappings(accessToken, iModelId);
    setMappings(mappings.sort((a, b) => a.mappingName.localeCompare(b.mappingName)));
  } catch (error: any) {
    setErrorMessage(getErrorMessage(error.status));
  } finally {
    setIsLoading(false);
  }
};

const fetchExtractionStatus = async (
  iModelId: string,
  getAccessToken: GetAccessTokenFn,
  extractionClient: IExtractionClient,
  setExtractionIconData: React.Dispatch<React.SetStateAction<ExtractionIconData>>,
  setExtractionMessageData: React.Dispatch<React.SetStateAction<ExtractionMessageData[]>>
) => {
  setExtractionIconData({
    iconStatus: "warning",
    iconMessage: "Extraction status pending.",
  });
  try {
    const accessToken = await getAccessToken();
    const extractions = await extractionClient.getExtractionHistory(accessToken, iModelId, 1);
    if (extractions.length === 0) {
      setExtractionIconData({
        iconStatus: "negative",
        iconMessage: "No extraction found.",
      });
    } else {
      const jobId = extractions[0].jobId;
      const status = await extractionClient.getExtractionStatus(accessToken, jobId);
      if (status.containsIssues) {
        setExtractionIconData({
          iconStatus: "negative",
          iconMessage: "Extraction contains issues. Click to view extraction logs.",
        });
        const logs = await extractionClient.getExtractionLogs(accessToken, jobId);
        const filteredLogs = logs.filter((log) => log.message !== null);
        const extractionMessageData = filteredLogs.map((filteredLog) =>
        (
          {
            date: filteredLog.dateTime,
            category: filteredLog.category,
            level: filteredLog.level,
            message: String(filteredLog.message),
          }
        ));
        setExtractionMessageData(extractionMessageData);
      } else {
        setExtractionIconData({
          iconStatus: "positive",
          iconMessage: "Extraction successful.",
        });
      }
    }
  } catch (error: any) {
    setExtractionIconData({
      iconStatus: "negative",
      iconMessage: "Operation failed. Please try again.",
    });
  }
};

export interface MappingsOperationsProps extends GroupingMappingApiConfig {
  mappingClient: IMappingsClient;
}

export interface ExtractionMessageData {
  date: string;
  category: string;
  level: string;
  message: string;
}

export interface ExtractionIconData {
  iconStatus: "negative" | "positive" | "warning";
  iconMessage: string;
}

export const useMappingsOperations = ({ iModelId, getAccessToken, mappingClient }: MappingsOperationsProps) => {
  const [showImportModal, setShowImportModal] = useState<boolean | undefined>(false);
  const [showDeleteModal, setShowDeleteModal] = useState<Mapping | undefined>(undefined);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [mappings, setMappings] = useState<Mapping[]>([]);
  const extractionClient = useExtractionClient();
  const [errorMessage, setErrorMessage] = useState<string | undefined>(undefined);
  const [isTogglingExtraction, setIsTogglingExtraction] = useState<boolean>(false);
  const [extractionIconData, setExtractionIconData] = useState<ExtractionIconData>({
    iconStatus: "warning",
    iconMessage: "",
  });
  const [showExtractionMessageModal, setShowExtractionMessageModal] = useState<boolean>(false);
  const [extractionMessageData, setExtractionMessageData] = useState<ExtractionMessageData[]>([]);

  useEffect(() => {
    void fetchMappings(setMappings, iModelId, setIsLoading, getAccessToken, mappingClient, setErrorMessage);
  }, [getAccessToken, mappingClient, iModelId]);

  useEffect(() => {
    void fetchExtractionStatus(
      iModelId,
      getAccessToken,
      extractionClient,
      setExtractionIconData,
      setExtractionMessageData
    );
  }, [iModelId, getAccessToken, extractionClient]);

  const refresh = useCallback(async () => {
    setMappings([]);
    await fetchMappings(setMappings, iModelId, setIsLoading, getAccessToken, mappingClient, setErrorMessage);
  }, [getAccessToken, mappingClient, iModelId]);

  const toggleExtraction = useCallback(async (mapping: Mapping) => {
    try {
      setIsTogglingExtraction(true);
      const newState = !mapping.extractionEnabled;
      const accessToken = await getAccessToken();
      await mappingClient.updateMapping(accessToken, iModelId, mapping.id, {
        extractionEnabled: newState,
      });
    } catch (error: any) {
      setErrorMessage(getErrorMessage(error.status));
    } finally {
      setIsTogglingExtraction(false);
    }
  }, [getAccessToken, iModelId, mappingClient]);

  const onDelete = async (mapping: Mapping) => {
    const accessToken = await getAccessToken();
    await mappingClient.deleteMapping(accessToken, iModelId, mapping.id);
    await refresh();
  };

  return { mappings, isLoading, extractionIconData, showExtractionMessageModal, extractionMessageData, setShowExtractionMessageModal, refresh, toggleExtraction, onDelete, setShowImportModal, showImportModal, setShowDeleteModal, showDeleteModal, isTogglingExtraction, errorMessage, setErrorMessage };
};
