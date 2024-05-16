/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import React from "react";
import { useMappingClient } from "../context/MappingClientContext";
import type { Mapping } from "@itwin/insights-client";
import { useGroupingMappingApiConfig } from "../context/GroupingApiConfigContext";
import type { CreateTypeFromInterface } from "../../common/utils";
import type { mappingViewDefaultDisplayStrings } from "./MappingsView";
import { MappingsView } from "./MappingsView";
import { useMappingsOperations } from "./hooks/useMappingsOperations";

export type IMappingTyped = CreateTypeFromInterface<Mapping>;

/**
 * Props for the {@link Mappings} component.
 * @public
 */
export interface MappingsProps {
  onClickAddMapping?: () => void;
  onClickMappingTitle?: (mapping: Mapping) => void;
  onClickMappingModify?: (mapping: Mapping) => void;
  displayStrings?: Partial<typeof mappingViewDefaultDisplayStrings>;
}

/**
 * Component to list mappings and handle basic operations.
 * @public
 */
export const Mappings = (props: MappingsProps) => {
  const groupingMappingApiConfig = useGroupingMappingApiConfig();
  const mappingClient = useMappingClient();
  const {
    mappings,
    isLoading,
    showExtractionMessageModal,
    extractionStatus,
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
  } = useMappingsOperations({ ...groupingMappingApiConfig, mappingClient });

  return (
    <MappingsView
      mappings={mappings ?? []}
      isLoading={isLoading}
      extractionStatusData={extractionStatus.extractionStatusIcon}
      showExtractionMessageModal={showExtractionMessageModal}
      extractionMessageData={extractionStatus.extractionMessageData}
      setShowExtractionMessageModal={setShowExtractionMessageModal}
      onRefreshMappings={refreshMappings}
      onRefreshExtractionStatus={refreshExtractionStatus}
      onToggleExtraction={toggleExtraction}
      onDelete={onDelete}
      showImportModal={showImportModal}
      setShowImportModal={setShowImportModal}
      showDeleteModal={showDeleteModal}
      setShowDeleteModal={setShowDeleteModal}
      isTogglingExtraction={isTogglingExtraction}
      {...props}
    />
  );
};
