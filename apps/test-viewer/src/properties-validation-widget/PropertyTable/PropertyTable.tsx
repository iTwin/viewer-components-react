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
import { CDMAttribute, CDMClient, ExtractionClient, ExtractionState, GroupMinimal, Mapping, Property } from "@itwin/insights-client";
import { useGroupingMappingApiConfig, useMappingClient, useMappingsOperations } from "@itwin/grouping-mapping-widget";
import { ExtractionStates } from "../Extraction/ExtractionStatus";
import { STATUS_CHECK_INTERVAL } from "../hooks/useFetchMappingExtractionStatus";
import { LoadingSpinner } from "@itwin/core-react";
import { usePapaParse } from "react-papaparse";
import { FunctionType } from "../PropertiesValidation/PropertiesValidationAction";

export const aggregationFunctions = [
  FunctionType.CountAtLeast,
  FunctionType.CountAtMost,
  FunctionType.CountRange,
  FunctionType.PercentAvailable,
  FunctionType.SumAtLeast,
  FunctionType.SumAtMost,
  FunctionType.SumRange,
];

export interface PropertyListProps {
  groupData: Property[];
  group: GroupMinimal;
  mapping: Mapping;
  onClickAdd?: () => void;
  onClickResults: (tableData: TableData) => void;
  refreshProperties: () => Promise<void>;
  isLoading: boolean;
  deleteProperty: (propertyId: string) => Promise<string>;
  columnsFactory: (handleShowDeleteModal: (value: ValidationRule) => void) => Array<Column<ValidationRule>>;
  ruleList: ValidationRule[];
}

export interface TableData {
  headers: string[];
  data: string[][];
}

export const PropertyTable = ({
  groupData,
  group,
  mapping,
  onClickAdd,
  onClickResults,
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
  const { readString } = usePapaParse();
  const extractionClient = new ExtractionClient();
  const cdmClient = new CDMClient();

  const onRunExtraction = useCallback(async () => {
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

  const evaluateAggregationFunctions = (tableData: TableData) => {
    const aggregationRules = ruleList.filter((rule) => aggregationFunctions.includes(rule.function));
    if (aggregationRules.length === 0) {
      return tableData;
    }
    let data = tableData.data;
    aggregationRules.forEach((rule) => {
      const aggPropertyIndex = tableData.headers.indexOf(rule.property.propertyName);
      const aggPropertyValues = tableData.data.map((row) => row[aggPropertyIndex]);
      const propertyValuesFiltered = aggPropertyValues.filter((value) => value !== "");
      const propertyValuesFilteredNum = propertyValuesFiltered.map((value) => parseFloat(value));
      let result = false;
      switch (rule.function) {
        case FunctionType.CountAtLeast:
          if (rule.min === undefined) {
            console.log("Min value not defined for CountAtLeast function");
            return tableData;
          }
          result = aggPropertyValues.length >= rule.min;
          break;
        case FunctionType.CountAtMost:
          if (rule.max === undefined) {
            console.log("Max value not defined for CountAtMost function");
            return tableData;
          }
          result = aggPropertyValues.length <= rule.max;
          break;
        case FunctionType.CountRange:
          if (rule.min === undefined || rule.max === undefined) {
            console.log("Min or Max value not defined for CountRange function");
            return tableData;
          }
          result = propertyValuesFiltered.length >= rule.min && propertyValuesFiltered.length <= rule.max;
          break;
        case FunctionType.PercentAvailable:
          if (rule.min === undefined) {
            console.log("Min value not defined for PercentAvailable function");
            return tableData;
          }
          result = propertyValuesFiltered.length / aggPropertyValues.length >= rule.min / 100;
          break;
        case FunctionType.SumAtLeast:
          if (rule.min === undefined) {
            console.log("Min value not defined for SumAtLeast function");
            return tableData;
          }
          result = propertyValuesFilteredNum.reduce((a, b) => a + b, 0) >= rule.min;
          break;
        case FunctionType.SumAtMost:
          if (rule.max === undefined) {
            console.log("Max value not defined for SumAtMost function");
            return tableData;
          }
          result = propertyValuesFilteredNum.reduce((a, b) => a + b, 0) <= rule.max;
          break;
        case FunctionType.SumRange:
          if (rule.min === undefined || rule.max === undefined) {
            console.log("Min or Max value not defined for SumRange function");
            return tableData;
          }
          const sumValues = propertyValuesFilteredNum.reduce((a, b) => a + b, 0);
          result = sumValues >= rule.min && sumValues <= rule.max;
          break;
        default:
          console.log("Error while evaluating aggregation functions");
          return tableData;
      }
      data = data.map((row) => {
        const dataUpToIndex = row.slice(0, aggPropertyIndex);
        const dataAfterIndex = row.slice(aggPropertyIndex + 1);
        return [...dataUpToIndex, result ? "true" : "false", ...dataAfterIndex];
      });
    });
    return { headers: tableData.headers, data: data };
  };

  const filterExtractedData = (data: string[][], colHeaders: CDMAttribute[] | undefined) => {
    if (!colHeaders) {
      return;
    }
    const relevantValidationProps = ruleList.map((rule) => rule.property.propertyName);
    const relevantDataProps = ruleList.map((rule) => rule.onProperty.propertyName);
    const relevantColumnNames = [...new Set([...relevantValidationProps, ...relevantDataProps])];
    const colHeadersNames = colHeaders.map((header) => header.name);
    const relevantColumnIndexes = relevantColumnNames.map((name) => colHeadersNames.indexOf(name));
    const filteredData = data.map((row) => relevantColumnIndexes.map((index) => row[index]));
    const filteredDataWithoutLastEmptyRow = filteredData.filter((row) => row.some((cell) => cell !== undefined));
    const tableData = { headers: relevantColumnNames, data: filteredDataWithoutLastEmptyRow };
    return tableData;
  };

  const getExtractedData = async () => {
    if (extractionId) {
      const accessToken = await groupingMappingApiConfig.getAccessToken();
      const cdm = await cdmClient.getCDM(accessToken, mapping.id, extractionId);
      if (cdm) {
        const colHeaders = cdm.entities.find((entity) => entity.name.includes(group.groupName))?.attributes;
        const location = cdm.entities.find((entity) => entity.name.includes(group.groupName))?.partitions[0].location;
        if (location) {
          console.log(mapping.id, extractionId, location);
          const csvData = await cdmClient.getCDMPartition(accessToken, mapping.id, extractionId, location);
          const csvText = await csvData.text();
          readString<string[]>(csvText, {
            worker: true,
            complete: (results) => {
              const tableData: TableData | undefined = filterExtractedData(results.data, colHeaders);
              if (!tableData) {
                console.log("Table data undefined");
                return;
              }
              const tableDataWithAggregations = evaluateAggregationFunctions(tableData);
              onClickResults(tableDataWithAggregations);
            },
          });
          return;
        } else {
          console.log("No location found");
          return;
        }
      } else {
        console.log("No CDM found");
      }
    }
  };

  const onViewResults = async () => {
    await getExtractedData();
  };

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
      <div className="pvw-action-buttons">
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
        <Button styleType="default" onClick={onViewResults} disabled={isLoading || extractionState !== ExtractionStates.Succeeded}>
          View Results
        </Button>
      </div>
      {showDeleteModal && <DeleteModal entityName={showDeleteModal.name} onClose={handleCloseDeleteModal} onDelete={handleDeleteProperty} />}
    </div>
  );
};
