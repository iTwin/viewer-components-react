/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
import { useCallback, useMemo, useState } from "react";
import { PropertyTableToolbar } from "./PropertyTableToolbar";
import DeleteModal from "./DeleteModal";
import { CreateTypeFromInterface } from "../utils";
import { Button, Table } from "@itwin/itwinui-react";
import type { Column } from "react-table";
import "./PropertyTable.scss";
import { ValidationRule } from "./PropertyMenu";
import { CDMClient, ExtractionClient, ExtractionState, Mapping, Property } from "@itwin/insights-client";
import { useGroupingMappingApiConfig, useMappingClient, useMappingsOperations } from "@itwin/grouping-mapping-widget";
import { ExtractionStates } from "../Extraction/ExtractionStatus";
import { STATUS_CHECK_INTERVAL } from "../hooks/useFetchMappingExtractionStatus";
import { LoadingSpinner } from "@itwin/core-react";

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
  const mappingClient = useMappingClient();
  const groupingMappingApiConfig = useGroupingMappingApiConfig();
  const { refreshExtractionStatus } = useMappingsOperations({
    ...groupingMappingApiConfig,
    mappingClient,
  });
  const extractionClient = new ExtractionClient();
  const cdmClient = new CDMClient();

  const onRunExtraction = useCallback(async () => {
    //const extractionDetails = await runExtraction([mapping]);
    const accessToken = await groupingMappingApiConfig.getAccessToken();
    const extractionDetails = await extractionClient.runExtraction(accessToken, {
      mappings: [{ id: mapping.id }],
      iModelId: groupingMappingApiConfig.iModelId,
    });
    setExtractionId(extractionDetails?.id || undefined);
    console.log("Extraction Details: ", extractionDetails);
    setExtractionState(ExtractionStates.Starting);
    // check status of extraction till succeeded or failed or timeout
    const interval = setInterval(async () => {
      const extractionStatus = await extractionClient.getExtractionStatus(accessToken, extractionDetails.id);
      switch (extractionStatus.state) {
        case ExtractionState.Succeeded || ExtractionState.PartiallySucceeded:
          setExtractionState(ExtractionStates.Succeeded);
          clearInterval(interval);
          break;
        case ExtractionState.Failed:
          setExtractionState(ExtractionStates.Failed);
          clearInterval(interval);
          break;
        case ExtractionState.Running:
          setExtractionState(ExtractionStates.Running);
          break;
        case ExtractionState.Queued:
          setExtractionState(ExtractionStates.Queued);
          break;
        default:
          setExtractionState(ExtractionStates.None);
          clearInterval(interval);
          break;
      }
    }, STATUS_CHECK_INTERVAL);
  }, [extractionClient, mapping]);

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
      <Button
        styleType="high-visibility"
        onClick={onRunExtraction}
        disabled={
          ruleList.length === 0 ||
          isLoading ||
          extractionState === ExtractionStates.Starting ||
          extractionState === ExtractionStates.Queued ||
          extractionState === ExtractionStates.Running
        }
      >
        {extractionState === ExtractionStates.Starting || extractionState === ExtractionStates.Queued || extractionState === ExtractionStates.Running ? (
          <LoadingSpinner />
        ) : (
          "Run Extraction"
        )}
      </Button>
      <Button styleType="high-visibility" onClick={() => {}} disabled={isLoading || extractionState !== ExtractionStates.Succeeded}>
        View Results
      </Button>
      {showDeleteModal && <DeleteModal entityName={showDeleteModal.name} onClose={handleCloseDeleteModal} onDelete={handleDeleteProperty} />}
    </div>
  );
};
