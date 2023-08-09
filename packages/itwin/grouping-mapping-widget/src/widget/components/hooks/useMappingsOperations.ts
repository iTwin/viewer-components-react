/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { useCallback, useEffect, useState } from "react";
import {
  getErrorMessage,
} from "../utils";
import type { IMappingsClient, Mapping } from "@itwin/insights-client";
import type { GroupingMappingApiConfig } from "../context/GroupingApiConfigContext";
import type { GetAccessTokenFn } from "../context/GroupingApiConfigContext";

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

export interface MappingsOperationsProps extends GroupingMappingApiConfig {
  mappingClient: IMappingsClient;
}

export const useMappingsOperations = ({ iModelId, getAccessToken, mappingClient }: MappingsOperationsProps) => {
  const [showDeleteModal, setShowDeleteModal] = useState<Mapping | undefined>(undefined);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [mappings, setMappings] = useState<Mapping[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | undefined>(undefined);
  const [isTogglingExtraction, setIsTogglingExtraction] = useState<boolean>(false);

  useEffect(() => {
    void fetchMappings(setMappings, iModelId, setIsLoading, getAccessToken, mappingClient, setErrorMessage);
  }, [getAccessToken, mappingClient, iModelId]);

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

  return { mappings, isLoading, refresh, toggleExtraction, onDelete, setShowDeleteModal, showDeleteModal, isTogglingExtraction, errorMessage, setErrorMessage };
};
