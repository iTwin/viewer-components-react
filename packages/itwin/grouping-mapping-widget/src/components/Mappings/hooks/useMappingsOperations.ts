/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { useCallback, useEffect, useRef, useState } from "react";
import { getErrorMessage } from "../../../common/utils";
import type { IExtractionClient, IMappingsClient, Mapping } from "@itwin/insights-client";
import type { GroupingMappingApiConfig } from "../../context/GroupingApiConfigContext";
import type { GetAccessTokenFn } from "../../context/GroupingApiConfigContext";
import { useExtractionClient } from "../../context/ExtractionClientContext";
import type { ExtractionStatusData } from "../../context/ExtractionStatusDataContext";
import type { ExtractionMessageData } from "../../context/ExtractionStatusDataContext";
import { useExtractionStatusDataContext } from "../../context/ExtractionStatusDataContext";

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
  setExtractionStatusIcon: (extractionStatusIcon: ExtractionStatusData | ((extractionStatusIcon: ExtractionStatusData) => ExtractionStatusData)) => void,
  setExtractionMessageData: (extractionMessageData: ExtractionMessageData[] | ((extractionMessageData: ExtractionMessageData[]) => ExtractionMessageData[])) => void
) => {
  try {
    setExtractionStatusIcon({
      iconStatus: undefined,
      iconMessage: "Loading...",
    });
    const accessToken = await getAccessToken();
    const extraction = await extractionClient.getExtractionHistory(accessToken, iModelId, 1);
    if(extraction.length === 0){
      setExtractionStatusIcon({
        iconStatus: "negative",
        iconMessage: "No extraction found.",
      });
    } else {
      const jobId = extraction[0].jobId;
      const status = await extractionClient.getExtractionStatus(accessToken, jobId);
      if (status.containsIssues) {
        const logs = await extractionClient.getExtractionLogs(accessToken, jobId);
        const filteredLogs = logs.filter((log) => log.message !== null);
        const extractionMessageData = filteredLogs.map((filteredLog) => ({
          date: filteredLog.dateTime,
          category: filteredLog.category,
          level: filteredLog.level,
          message: String(filteredLog.message),
        }));
        setExtractionMessageData(extractionMessageData);
        setExtractionStatusIcon({
          iconStatus: "negative",
          iconMessage: "Extraction contains issues. Click to view extraction logs.",
        });
      } else {
        setExtractionStatusIcon({
          iconStatus: "positive",
          iconMessage: "Extraction successful.",
        });
      }
    }
  } catch (error: any) {
    setExtractionStatusIcon({
      iconStatus: "negative",
      iconMessage: "Operation failed. Please try again.",
    });
  }
};

export interface MappingsOperationsProps extends GroupingMappingApiConfig {
  mappingClient: IMappingsClient;
}

export const useMappingsOperations = ({ iModelId, getAccessToken, mappingClient }: MappingsOperationsProps) => {
  const [showImportModal, setShowImportModal] = useState<boolean | undefined>(false);
  const [showDeleteModal, setShowDeleteModal] = useState<Mapping | undefined>(undefined);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [mappings, setMappings] = useState<Mapping[]>([]);
  const extractionClient = useExtractionClient();
  const [errorMessage, setErrorMessage] = useState<string | undefined>(undefined);
  const [isTogglingExtraction, setIsTogglingExtraction] = useState<boolean>(false);
  const {extractionStatusIcon, extractionMessageData, setExtractionStatusIcon, setExtractionMessageData} = useExtractionStatusDataContext();
  const [showExtractionMessageModal, setShowExtractionMessageModal] = useState<boolean>(false);
  const previousStatusIcon = useRef<ExtractionStatusData>();

  useEffect(() => {
    void fetchMappings(setMappings, iModelId, setIsLoading, getAccessToken, mappingClient, setErrorMessage);
  }, [getAccessToken, mappingClient, iModelId]);

  useEffect(() => {
    previousStatusIcon.current = extractionStatusIcon;
  }, [extractionStatusIcon]);

  useEffect(() => {
    if(previousStatusIcon.current?.iconStatus === undefined) {
      void fetchExtractionStatus(
        iModelId,
        getAccessToken,
        extractionClient,
        setExtractionStatusIcon,
        setExtractionMessageData
      );
    }
  }, [iModelId, getAccessToken, extractionClient, isLoading, setExtractionStatusIcon, setExtractionMessageData]);

  const refresh = useCallback(async () => {
    setMappings([]);
    void fetchExtractionStatus(iModelId, getAccessToken, extractionClient, setExtractionStatusIcon, setExtractionMessageData);
    await fetchMappings(setMappings, iModelId, setIsLoading, getAccessToken, mappingClient, setErrorMessage);
  }, [extractionClient, getAccessToken, mappingClient, iModelId, setExtractionMessageData, setExtractionStatusIcon]);

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

  return { mappings, isLoading, extractionStatusIcon, showExtractionMessageModal, extractionMessageData, setShowExtractionMessageModal, refresh, toggleExtraction, onDelete, setShowImportModal, showImportModal, setShowDeleteModal, showDeleteModal, isTogglingExtraction, errorMessage, setErrorMessage };
};
