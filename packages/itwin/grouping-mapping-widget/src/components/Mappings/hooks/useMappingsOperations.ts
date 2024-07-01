/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
import { useCallback, useEffect, useState } from "react";
import { ExtractionState } from "@itwin/insights-client";
import type { IMappingsClient, Mapping } from "@itwin/insights-client";
import type { GroupingMappingApiConfig } from "../../context/GroupingApiConfigContext";
import { useExtractionClient } from "../../context/ExtractionClientContext";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useFetchMappings } from "./useFetchMappings";
import { useFetchExtractionStatus } from "./useFetchExtractionStatus";
import { useExtractionStateJobContext } from "../../context/ExtractionStateJobContext";

/**
 * Props for the {@link useMappingsOperations} hook.
 * @internal
 */
export interface MappingsOperationsProps extends GroupingMappingApiConfig {
  mappingClient: IMappingsClient;
}

/**
 * Custom hook to handle mapping operations.
 * @internal
 */
export const useMappingsOperations = ({ iModelId, getAccessToken, mappingClient }: MappingsOperationsProps) => {
  const [showImportModal, setShowImportModal] = useState<boolean | undefined>(false);
  const [showDeleteModal, setShowDeleteModal] = useState<Mapping | undefined>(undefined);
  const extractionClient = useExtractionClient();
  const [showExtractionMessageModal, setShowExtractionMessageModal] = useState<boolean>(false);
  const queryClient = useQueryClient();
  const [initialStateExtractionFlag, setInitialExtractionStateFlag] = useState<boolean>(true);
  const { mappingIdJobInfo, setMappingIdJobInfo } = useExtractionStateJobContext();

  const { data: mappings, isFetched: isMappingsFetched, isFetching: isLoadingMappings } = useFetchMappings(iModelId, getAccessToken, mappingClient);

  const {
    data: extractionStatus,
    isFetched: isExtractionStatusFetched,
    isFetching: isLoadingExtractionStatus,
  } = useFetchExtractionStatus({ iModelId, getAccessToken, extractionClient });

  const refreshExtractionStatus = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: ["iModelExtractionStatus"] });
    setInitialExtractionStateFlag(false);
  }, [queryClient]);

  useEffect(() => {
    if (initialStateExtractionFlag && isMappingsFetched && isExtractionStatusFetched && mappings && extractionStatus && !mappingIdJobInfo.size) {
      const newMappingIdJobInfo = new Map<string, string>();
      const latestExtractionResultId = extractionStatus.latestExtractionResult.value?.id;
      const state = extractionStatus.latestExtractionResult.value?.state;
      if (state === ExtractionState.Failed || state === ExtractionState.Succeeded || state === ExtractionState.PartiallySucceeded) return;
      !!latestExtractionResultId &&
        mappings.forEach((mapping) => {
          const mappingId = mapping.id;
          const latestExtractionResultId = extractionStatus.latestExtractionResult.value.id;
          newMappingIdJobInfo.set(mappingId, latestExtractionResultId);
        });
      setMappingIdJobInfo(newMappingIdJobInfo);
      setInitialExtractionStateFlag(false);
    }
  }, [extractionStatus, initialStateExtractionFlag, isExtractionStatusFetched, isMappingsFetched, mappingIdJobInfo.size, mappings, setMappingIdJobInfo]);

  const refreshMappings = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: ["mappings"] });
  }, [queryClient]);

  const { mutateAsync: toggleExtraction, isLoading: isTogglingExtraction } = useMutation({
    mutationFn: async (mapping: Mapping) => {
      const accessToken = await getAccessToken();
      const newState = !mapping.extractionEnabled;
      await mappingClient.updateMapping(accessToken, mapping.id, { extractionEnabled: newState });
    },
    onSuccess: async () => {
      await refreshMappings();
    },
  });

  const { mutateAsync: onDelete, isLoading: isDeletingMapping } = useMutation({
    mutationFn: async (mapping: Mapping) => {
      const accessToken = await getAccessToken();
      await mappingClient.deleteMapping(accessToken, mapping.id);
    },
    onSuccess: async () => {
      await refreshMappings();
    },
  });

  const isLoading = isLoadingMappings || isTogglingExtraction || isDeletingMapping;
  const extractionStatusGated =
    !extractionStatus || isLoadingExtractionStatus
      ? {
          extractionStatusIcon: {
            iconStatus: undefined,
            iconMessage: "Loading...",
          },
          extractionMessageData: [],
        }
      : extractionStatus;

  return {
    mappings,
    isLoading,
    showExtractionMessageModal,
    extractionStatus: extractionStatusGated,
    setShowExtractionMessageModal,
    refreshMappings,
    refreshExtractionStatus,
    toggleExtraction,
    onDelete,
    setShowImportModal,
    showImportModal,
    setShowDeleteModal,
    showDeleteModal,
    isTogglingExtraction,
  };
};
