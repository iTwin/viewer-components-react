/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { Modal, Table, tableFilters } from "@itwin/itwinui-react";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Mapping, MappingsClient } from "@itwin/insights-client";
import ActionPanel from "./ActionPanel";
import "./AddMappingsModal.scss";
import { LocalizedTablePaginator } from "./LocalizedTablePaginator";
import type { ReportMappingAndMapping } from "./ReportMappings";
import { useReportsConfigApi } from "../context/ReportsConfigApiContext";
import { SelectIModel } from "./SelectIModel";
import type { CreateTypeFromInterface } from "./utils";
import { handleError } from "./utils";
import { ReportsConfigWidget } from "../../ReportsConfigWidget";
import type { AccessToken } from "@itwin/core-bentley";
import type { Column } from "react-table";

export type MappingType = CreateTypeFromInterface<Mapping>;

const fetchMappings = async (
  setMappings: (mappings: Mapping[]) => void,
  iModelId: string,
  setIsLoading: (isLoading: boolean) => void,
  mappingsClient: MappingsClient,
  getAccessToken: () => Promise<AccessToken>
) => {
  try {
    setIsLoading(true);
    const accessToken = await getAccessToken();
    const mappings = await mappingsClient.getMappings(
      accessToken,
      iModelId
    );
    setMappings(mappings.mappings);
  } catch (error: any) {
    handleError(error.status);
  } finally {
    setIsLoading(false);
  }
};

export interface AddMappingsModalProps {
  reportId: string;
  existingMappings: ReportMappingAndMapping[];
  show: boolean;
  onClose: () => Promise<void>;
  defaultIModelId?: string;
}

export const AddMappingsModal = ({
  reportId,
  existingMappings,
  show,
  onClose,
  defaultIModelId,
}: AddMappingsModalProps) => {
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const selectedMappings = useRef<Mapping[]>([]);
  const [selectedIModelId, setSelectediModelId] = useState<string | undefined>(defaultIModelId);
  const [mappings, setMappings] = useState<Mapping[]>([]);
  const { getAccessToken, mappingsClient, reportsClient } = useReportsConfigApi();

  useEffect(() => {
    if (selectedIModelId) {
      void fetchMappings(
        setMappings,
        selectedIModelId,
        setIsLoading,
        mappingsClient,
        getAccessToken
      );
    }
  }, [getAccessToken, mappingsClient, selectedIModelId, setIsLoading]);

  const mappingsColumns = useMemo(
    (): Column<CreateTypeFromInterface<Mapping>>[] => [
      {
        id: "mappingName",
        Header: ReportsConfigWidget.localization.getLocalizedString(
          "ReportsConfigWidget:MappingName"
        ),
        accessor: "mappingName",
        Filter: tableFilters.TextFilter(),
      },
      {
        id: "description",
        Header: ReportsConfigWidget.localization.getLocalizedString(
          "ReportsConfigWidget:Description"
        ),
        accessor: "description",
        Filter: tableFilters.TextFilter(),
      }],
    []
  );

  const onSave = async () => {
    try {
      if (!selectedIModelId) return;
      setIsLoading(true);
      const accessToken = await getAccessToken();
      for (const mapping of selectedMappings.current) {
        await reportsClient.createReportMapping(accessToken, reportId, {
          imodelId: selectedIModelId,
          mappingId: mapping.id,
        });
      }

      await onClose();
    } catch (error: any) {
      handleError(error.status);
    } finally {
      setIsLoading(false);
    }
  };

  const onSelect = useCallback((selectData: Mapping[] | undefined) => {
    if (selectData) selectedMappings.current = selectData;
  }, []);

  const tableData = useMemo(() => isLoading ? [] : mappings, [isLoading, mappings]);
  const isRowDisabled = useCallback((rowData: MappingType) =>
    existingMappings.some((v) => v.mappingId === rowData.id), [existingMappings]);

  return (
    <Modal
      title={ReportsConfigWidget.localization.getLocalizedString(
        "ReportsConfigWidget:AddMappings"
      )}
      isOpen={show}
      isDismissible={!isLoading}
      onClose={async () => {
        await onClose();
      }}
      style={{ display: "flex", flexDirection: "column", maxHeight: "77vh" }}
    >
      <div className="rcw-add-mappings-container">
        <SelectIModel
          selectedIModelId={selectedIModelId}
          setSelectedIModelId={setSelectediModelId}
        />
        <Table<MappingType>
          data={tableData}
          columns={mappingsColumns}
          className="rcw-add-mappings-table"
          emptyTableContent={ReportsConfigWidget.localization.getLocalizedString(
            "ReportsConfigWidget:NoMappingsAvailable"
          )}
          isSortable
          isSelectable
          isLoading={isLoading}
          isRowDisabled={isRowDisabled}
          onSelect={onSelect}
          paginatorRenderer={LocalizedTablePaginator}
        />
      </div>
      {/* Add button permanently enabled as a workaround to the warning stating that the table and parent component are being rendered at the same time. */}
      <ActionPanel
        actionLabel={ReportsConfigWidget.localization.getLocalizedString(
          "ReportsConfigWidget:Add"
        )}
        onAction={onSave}
        isLoading={isLoading}
      />
    </Modal>
  );
};
