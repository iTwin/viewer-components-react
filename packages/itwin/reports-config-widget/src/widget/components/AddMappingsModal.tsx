/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { Modal, Table, tableFilters } from "@itwin/itwinui-react";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Mapping } from "@itwin/insights-client";
import { MappingsClient, REPORTING_BASE_PATH, ReportsClient } from "@itwin/insights-client";
import ActionPanel from "./ActionPanel";
import "./AddMappingsModal.scss";
import { LocalizedTablePaginator } from "./LocalizedTablePaginator";
import type { ReportMappingAndMapping } from "./ReportMappings";
import { useReportsApiConfig } from "../context/ReportsApiConfigContext";
import { SelectIModel } from "./SelectIModel";
import type { CreateTypeFromInterface } from "./utils";
import { generateUrl, handleError } from "./utils";
import { ReportsConfigWidget } from "../../ReportsConfigWidget";
import type { AccessToken } from "@itwin/core-bentley";

export type MappingType = CreateTypeFromInterface<Mapping>;

const fetchMappings = async (
  setMappings: React.Dispatch<React.SetStateAction<Mapping[]>>,
  iModelId: string,
  setIsLoading: React.Dispatch<React.SetStateAction<boolean>>,
  baseUrl: string,
  getAccessToken: () => Promise<AccessToken>
) => {
  try {
    setIsLoading(true);
    const mappingsClientApi = new MappingsClient(
      generateUrl(REPORTING_BASE_PATH, baseUrl)
    );
    const accessToken = await getAccessToken();
    const mappings = await mappingsClientApi.getMappings(
      accessToken,
      iModelId
    );
    setMappings(mappings);
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
}

export const AddMappingsModal = ({
  reportId,
  existingMappings,
  show,
  onClose,
}: AddMappingsModalProps) => {
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const selectedMappings = useRef<Mapping[]>([]);
  const [selectedIModelId, setSelectediModelId] = useState<string>("");
  const [mappings, setMappings] = useState<Mapping[]>([]);
  const { getAccessToken, baseUrl } = useReportsApiConfig();

  useEffect(() => {
    if (selectedIModelId) {
      void fetchMappings(
        setMappings,
        selectedIModelId,
        setIsLoading,
        baseUrl,
        getAccessToken
      );
    }
  }, [baseUrl, getAccessToken, selectedIModelId, setIsLoading]);

  const mappingsColumns = useMemo(
    () => [
      {
        Header: "Table",
        columns: [
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
          },
        ],
      },
    ],
    []
  );

  const onSave = async () => {
    try {
      if (!selectedIModelId) return;
      setIsLoading(true);
      const reportsClientApi = new ReportsClient(
        generateUrl(REPORTING_BASE_PATH, baseUrl)
      );
      const accessToken = await getAccessToken();
      for (const mapping of selectedMappings.current) {
        await reportsClientApi.createReportMapping(accessToken, reportId, {
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
