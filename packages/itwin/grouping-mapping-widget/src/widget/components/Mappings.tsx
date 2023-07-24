/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import React, { useCallback, useEffect, useState } from "react";
import {
  handleError,
} from "./utils";
import { useMappingClient } from "./context/MappingClientContext";
import type { IMappingsClient, Mapping } from "@itwin/insights-client";
import type { GetAccessTokenFn, GroupingMappingApiConfig } from "./context/GroupingApiConfigContext";
import { useGroupingMappingApiConfig } from "./context/GroupingApiConfigContext";
import type { CreateTypeFromInterface } from "../utils";
import type { mappingUIDefaultDisplayStrings } from "./MappingsUI";
import { MappingsUI } from "./MappingsUI";

export type IMappingTyped = CreateTypeFromInterface<Mapping>;

export interface MappingsProps {
  onClickAddMapping?: () => void;
  onClickMappingTitle?: (mapping: Mapping) => void;
  onClickMappingModify?: (mapping: Mapping) => void;
  displayStrings?: Partial<typeof mappingUIDefaultDisplayStrings>;
}

const fetchMappings = async (
  setMappings: React.Dispatch<React.SetStateAction<Mapping[]>>,
  iModelId: string,
  setIsLoading: React.Dispatch<React.SetStateAction<boolean>>,
  getAccessToken: GetAccessTokenFn,
  mappingsClient: IMappingsClient
) => {
  try {
    setIsLoading(true);
    const accessToken = await getAccessToken();
    const mappings = await mappingsClient.getMappings(accessToken, iModelId);
    setMappings(mappings.sort((a, b) => a.mappingName.localeCompare(b.mappingName)));
  } catch (error: any) {
    handleError(error.status);
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
  const [isTogglingExtraction, setIsTogglingExtraction] = useState<boolean>(false);

  useEffect(() => {
    void fetchMappings(setMappings, iModelId, setIsLoading, getAccessToken, mappingClient);
  }, [getAccessToken, mappingClient, iModelId]);

  const refresh = useCallback(async () => {
    setMappings([]);
    await fetchMappings(setMappings, iModelId, setIsLoading, getAccessToken, mappingClient);
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
      handleError(error.status);
    } finally {
      setIsTogglingExtraction(false);
    }
  }, [getAccessToken, iModelId, mappingClient]);

  const onDelete = async (mapping: Mapping) => {
    const accessToken = await getAccessToken();
    await mappingClient.deleteMapping(accessToken, iModelId, mapping.id);
    await refresh();
  };

  return { mappings, isLoading, refresh, toggleExtraction, onDelete, setShowDeleteModal, showDeleteModal, isTogglingExtraction };
};

export const Mappings = (props: MappingsProps) => {
  const groupingMappingApiConfig = useGroupingMappingApiConfig();
  const mappingClient = useMappingClient();
  const {
    mappings,
    isLoading,
    refresh,
    toggleExtraction,
    onDelete,
    setShowDeleteModal,
    showDeleteModal,
    isTogglingExtraction,
  } = useMappingsOperations({ ...groupingMappingApiConfig, mappingClient });

  return (
    <MappingsUI
      mappings={mappings}
      isLoading={isLoading}
      onRefresh={refresh}
      onToggleExtraction={toggleExtraction}
      onDelete={onDelete}
      showDeleteModal={showDeleteModal}
      setShowDeleteModal={setShowDeleteModal}
      isTogglingExtraction={isTogglingExtraction}
      {...props}
    />
  );
};
