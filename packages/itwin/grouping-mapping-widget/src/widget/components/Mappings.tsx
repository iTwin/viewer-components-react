/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import React, { useCallback } from "react";
import { useMappingClient } from "./context/MappingClientContext";
import type { Mapping } from "@itwin/insights-client";
import { useGroupingMappingApiConfig } from "./context/GroupingApiConfigContext";
import type { CreateTypeFromInterface } from "../utils";
import type { mappingViewDefaultDisplayStrings } from "./MappingsView";
import { MappingsView } from "./MappingsView";
import { useMappingsOperations } from "./hooks/useMappingsOperations";
import { Alert } from "@itwin/itwinui-react";

export type IMappingTyped = CreateTypeFromInterface<Mapping>;

export interface MappingsProps {
  onClickAddMapping?: () => void;
  onClickMappingTitle?: (mapping: Mapping) => void;
  onClickMappingModify?: (mapping: Mapping) => void;
  displayStrings?: Partial<typeof mappingViewDefaultDisplayStrings>;
}

export const Mappings = (props: MappingsProps) => {
  const groupingMappingApiConfig = useGroupingMappingApiConfig();
  const mappingClient = useMappingClient();
  const {
    mappings,
    isLoading,
    refresh,
    toggleExtraction,
    onDelete,
    setShowImportModal,
    showImportModal,
    setShowDeleteModal,
    showDeleteModal,
    isTogglingExtraction,
    errorMessage,
    setErrorMessage,
  } = useMappingsOperations({ ...groupingMappingApiConfig, mappingClient });

  const renderAlert = useCallback(() => {
    if (!errorMessage) return;
    return (
      <Alert type="negative" onClose={() => setErrorMessage(undefined)}>
        {errorMessage}
      </Alert>
    );
  }, [errorMessage, setErrorMessage]);

  return (
    <MappingsView
      mappings={mappings}
      isLoading={isLoading}
      onRefresh={refresh}
      onToggleExtraction={toggleExtraction}
      onDelete={onDelete}
      showImportModal={showImportModal}
      setShowImportModal={setShowImportModal}
      showDeleteModal={showDeleteModal}
      setShowDeleteModal={setShowDeleteModal}
      isTogglingExtraction={isTogglingExtraction}
      alert={renderAlert()}
      {...props}
    />
  );
};
