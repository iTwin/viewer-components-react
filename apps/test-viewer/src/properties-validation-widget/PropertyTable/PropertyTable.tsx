/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
import { useCallback, useEffect, useMemo, useState } from "react";
import { PropertyTableToolbar } from "./PropertyTableToolbar";
import DeleteModal from "./DeleteModal";
import { CreateTypeFromInterface } from "../utils";
import { Button, Table } from "@itwin/itwinui-react";
import type { Column } from "react-table";
import "./PropertyTable.scss";
import { ValidationRule } from "./PropertyMenu";
import { CDMClient, Mapping, Property } from "@itwin/insights-client";
import { useGroupingMappingApiConfig, useMappingClient, useMappingsOperations } from "@itwin/grouping-mapping-widget";
import { useRunExtraction } from "../hooks/useRunExtraction";
import { BeEvent } from "@itwin/core-bentley";
import { ExtractionStates } from "../Extraction/ExtractionStatus";
import { useFetchMappingExtractionStatus } from "../hooks/useFetchMappingExtractionStatus";
import { useQueryClient } from "@tanstack/react-query";
import { useExtractionStateJobContext } from "../context/ExtractionStateJobContext";

export interface PropertyTableItem {
  name: string;
  id: string;
}
export interface PropertyListProps {
  groupData: Property[];
  mapping: Mapping;
  onClickAdd?: () => void;
  refreshProperties: () => Promise<void>;
  isLoading: boolean;
  deleteProperty: (propertyId: string) => Promise<string>;
  columnsFactory: (handleShowDeleteModal: (value: ValidationRule) => void) => Array<Column<ValidationRule>>;
  ruleList: ValidationRule[];
}

export const PropertyTable = ({
  groupData,
  mapping,
  onClickAdd,
  refreshProperties,
  isLoading,
  deleteProperty,
  columnsFactory,
  ruleList,
}: PropertyListProps) => {
  const [showDeleteModal, setShowDeleteModal] = useState<ValidationRule | undefined>(undefined);
  const [extractionState, setExtractionState] = useState<ExtractionStates | undefined>(ExtractionStates.None);
  const [extractionId, setExtractionId] = useState<string | undefined>(undefined);
  const [isJobStarted, setIsJobStarted] = useState<boolean>(false);
  const mappingClient = useMappingClient();
  const groupingMappingApiConfig = useGroupingMappingApiConfig();
  const statusQuery = useFetchMappingExtractionStatus({ ...groupingMappingApiConfig, mapping, enabled: isJobStarted });
  const { runExtraction } = useRunExtraction(groupingMappingApiConfig);
  const { showExtractionMessageModal, extractionStatus, setShowExtractionMessageModal, refreshExtractionStatus } = useMappingsOperations({
    ...groupingMappingApiConfig,
    mappingClient,
  });
  const { mappingIdJobInfo, setMappingIdJobInfo } = useExtractionStateJobContext();
  const queryClient = useQueryClient();
  const cdmClient = new CDMClient();

  const jobStartEvent = useMemo(() => new BeEvent<(mappingId: string) => void>(), []);

  useEffect(() => {
    if (mappingIdJobInfo.get(mapping.id)) {
      setIsJobStarted(true);
    }
  }, [mappingIdJobInfo, mapping.id]);

  const resolveTerminalExtractionStatus = useCallback(async () => {
    const state = statusQuery.data!.finalExtractionStateValue;
    if (state === ExtractionStates.Failed || state === ExtractionStates.Succeeded) {
      setIsJobStarted(false);
      setMappingIdJobInfo((prevMap: Map<string, string>) => {
        const newMap = new Map(prevMap);
        newMap.delete(mapping.id);
        return newMap;
      });
      await queryClient.invalidateQueries({ queryKey: ["iModelExtractionStatus"] });
    }
  }, [mapping.id, queryClient, setMappingIdJobInfo, statusQuery.data]);

  useEffect(() => {
    const listener = (startedMappingId: string) => {
      if (startedMappingId === mapping.id) {
        setExtractionState(ExtractionStates.Starting);
        setIsJobStarted(true);
      }
    };
    jobStartEvent.addListener(listener);

    return () => {
      jobStartEvent.removeListener(listener);
    };
  }, [jobStartEvent, mapping.id, mappingIdJobInfo?.get(mapping.id)]);

  useEffect(() => {
    const isStatusReady = statusQuery.data && statusQuery.isFetched;
    if (isStatusReady) {
      setExtractionState(statusQuery.data.finalExtractionStateValue);
      // No need to await. We don't need to wait for the status to be resolved in invalidation.
      void resolveTerminalExtractionStatus();
    }
  }, [resolveTerminalExtractionStatus, statusQuery]);

  const onRunExtraction = useCallback(async () => {
    const extractionDetails = await runExtraction([mapping]);
    setExtractionId(extractionDetails?.id || undefined);
    console.log("Extraction Details: ", extractionDetails);
    jobStartEvent.raiseEvent(mapping.id);
  }, [jobStartEvent, runExtraction, mapping]);

  const handleDeleteProperty = useCallback(async () => {
    await deleteProperty(showDeleteModal?.property.id ?? "");
  }, [deleteProperty, showDeleteModal?.property.id]);

  const handleShowDeleteModal = useCallback((rule: ValidationRule) => {
    setShowDeleteModal(rule);
  }, []);

  const handleCloseDeleteModal = () => {
    setShowDeleteModal(undefined);
  };

  const memoizedColumns = useMemo(() => columnsFactory(handleShowDeleteModal), [columnsFactory, handleShowDeleteModal]);

  return (
    <div className="pvw-property-list-container">
      <PropertyTableToolbar
        onClickAddProperty={onClickAdd}
        refreshProperties={refreshProperties}
        refreshExtractionStatus={refreshExtractionStatus}
        isLoading={isLoading}
        extractionState={extractionState}
        setExtractionState={setExtractionState}
      />
      <Table<CreateTypeFromInterface<ValidationRule>>
        data={isLoading ? [] : ruleList}
        density="extra-condensed"
        columns={memoizedColumns}
        emptyTableContent={`No Validation Properties`}
        isSortable
        isLoading={isLoading}
      />
      <Button styleType="high-visibility" onClick={onRunExtraction} disabled={ruleList.length === 0 || isLoading}>
        Run Extraction
      </Button>
      <Button styleType="high-visibility" onClick={refreshExtractionStatus} disabled={isLoading}></Button>
      {showDeleteModal && <DeleteModal entityName={showDeleteModal.name} onClose={handleCloseDeleteModal} onDelete={handleDeleteProperty} />}
    </div>
  );
};
