/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { useCallback, useState } from "react";
import type { ExtractionRunRequest, IMappingsClient, Mapping } from "@itwin/insights-client";
import type { GroupingMappingApiConfig } from "../../context/GroupingApiConfigContext";
import { useExtractionClient } from "../../context/ExtractionClientContext";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useFetchMappings } from "./useFetchMappings";
import { useFetchExtractionStatus } from "./useFetchExtractionStatus";

export interface MappingsOperationsProps extends GroupingMappingApiConfig {
  mappingClient: IMappingsClient;
}

export const useMappingsOperations = ({ iModelId, getAccessToken, mappingClient }: MappingsOperationsProps) => {
  const [showImportModal, setShowImportModal] = useState<boolean | undefined>(false);
  const [showDeleteModal, setShowDeleteModal] = useState<Mapping | undefined>(undefined);
  const extractionClient = useExtractionClient();
  const [showExtractionMessageModal, setShowExtractionMessageModal] = useState<boolean>(false);
  const queryClient = useQueryClient();

  const {
    data: mappings,
    isFetching: isLoadingMappings,
  } = useFetchMappings(iModelId, getAccessToken, mappingClient);

  const {
    data: extractionStatus,
    isFetching: isLoadingExtractionStatus,
  } = useFetchExtractionStatus({ iModelId, getAccessToken, extractionClient });

  const refreshExtractionStatus = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: ["iModelExtractionStatus"] });
  }, [queryClient]);

  const refreshMappings = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: ["mappings"] });
  }, [queryClient]);

  const { mutateAsync: toggleExtraction, isLoading: isTogglingExtraction } = useMutation({
    mutationFn: async (mapping: Mapping) => {
      const accessToken = await getAccessToken();
      const newState = !mapping.extractionEnabled;
      await mappingClient.updateMapping(accessToken, iModelId, mapping.id, { extractionEnabled: newState });
    },
    onSuccess: async () => {
      await refreshMappings();
    },
  });

  const { mutateAsync: runExtraction } = useMutation({
    mutationFn: async (mapping: Mapping) => {
      const accessToken = await getAccessToken();
      const extractionRequest: ExtractionRunRequest | undefined = {
        mappings: mapping === undefined ? undefined : [
          {
            id: mapping.id,
          },
        ],
      };
      await extractionClient.runExtraction(accessToken, iModelId, extractionRequest);
    },
    onSuccess: async () => {
      await refreshExtractionStatus();
    },
  });

  const { mutateAsync: onDelete, isLoading: isDeletingMapping } = useMutation({
    mutationFn: async (mapping: Mapping) => {
      const accessToken = await getAccessToken();
      await mappingClient.deleteMapping(accessToken, iModelId, mapping.id);
    },
    onSuccess: async () => {
      await refreshMappings();
    },
  });

  const isLoading = isLoadingMappings || isLoadingExtractionStatus || isTogglingExtraction || isDeletingMapping;
  const extractionStatusGated = extractionStatus ?? {
    extractionStatusIcon: {
      iconStatus: undefined,
      iconMessage: "Loading...",
    }, extractionMessageData: [],
  };

  return { mappings, isLoading, showExtractionMessageModal, extractionStatus: extractionStatusGated, setShowExtractionMessageModal, refreshMappings, refreshExtractionStatus, toggleExtraction, onDelete, setShowImportModal, showImportModal, setShowDeleteModal, showDeleteModal, runExtraction, isTogglingExtraction };
};
