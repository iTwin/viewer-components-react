/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import React, { } from "react";
import { useMappingClient } from "./context/MappingClientContext";
import type { Mapping } from "@itwin/insights-client";
import { useGroupingMappingApiConfig } from "./context/GroupingApiConfigContext";
import type { CreateTypeFromInterface } from "../utils";
import type { mappingUIDefaultDisplayStrings } from "./MappingsUI";
import { MappingsUI } from "./MappingsUI";
import { useMappingsOperations } from "./hooks/useMappingsOperations";

export type IMappingTyped = CreateTypeFromInterface<Mapping>;

export interface MappingsProps {
  onClickAddMapping?: () => void;
  onClickMappingTitle?: (mapping: Mapping) => void;
  onClickMappingModify?: (mapping: Mapping) => void;
  displayStrings?: Partial<typeof mappingUIDefaultDisplayStrings>;
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
