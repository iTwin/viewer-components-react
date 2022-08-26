/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { Modal, Table, tableFilters } from "@itwin/itwinui-react";
import React, { useEffect, useMemo, useState } from "react";
import type { Mapping } from "@itwin/insights-client";
import { ReportsClient } from "@itwin/insights-client";
import { MappingsClient, REPORTING_BASE_PATH } from "@itwin/insights-client";
import ActionPanel from "./ActionPanel";
import "./AddMappingsModal.scss";
import { LocalizedTablePaginator } from "./LocalizedTablePaginator";
import type { ReportMappingAndMapping } from "./ReportMappings";
import type { ReportsApiConfig } from "../context/ReportsApiConfigContext";
import { useReportsApiConfig } from "../context/ReportsApiConfigContext";
import { SelectIModel } from "./SelectIModel";
import type { CreateTypeFromInterface } from "./utils";
import { generateUrl, handleError } from "./utils";
import { ReportsConfigWidget } from "../../ReportsConfigWidget";

export type MappingType = CreateTypeFromInterface<Mapping>;

const fetchMappings = async (
  setMappings: React.Dispatch<React.SetStateAction<Mapping[]>>,
  iModelId: string,
  setIsLoading: React.Dispatch<React.SetStateAction<boolean>>,
  apiContext: ReportsApiConfig
) => {
  try {
    setIsLoading(true);
    const mappingsClientApi = new MappingsClient(
      generateUrl(REPORTING_BASE_PATH, apiContext.baseUrl)
    );
    const accessToken = await apiContext.getAccessToken();
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

interface AddMappingsModalProps {
  reportId: string;
  existingMappings: ReportMappingAndMapping[];
  show: boolean;
  returnFn: () => Promise<void>;
}

const AddMappingsModal = ({
  reportId,
  existingMappings,
  show,
  returnFn,
}: AddMappingsModalProps) => {
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [selectedMappings, setSelectedMappings] = useState<Mapping[]>([]);
  const [selectedIModelId, setSelectediModelId] = useState<string>("");
  const [mappings, setMappings] = useState<Mapping[]>([]);
  const apiConfig = useReportsApiConfig();

  useEffect(() => {
    if (selectedIModelId) {
      void fetchMappings(
        setMappings,
        selectedIModelId,
        setIsLoading,
        apiConfig
      );
    }
  }, [apiConfig, selectedIModelId, setIsLoading]);

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
        generateUrl(REPORTING_BASE_PATH, apiConfig.baseUrl)
      );
      const accessToken = await apiConfig.getAccessToken();
      for (const mapping of selectedMappings) {
        await reportsClientApi.createReportMapping(accessToken, reportId, {
          imodelId: selectedIModelId,
          mappingId: mapping.id,
        });
      }

      await returnFn();
    } catch (error: any) {
      handleError(error.status);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Modal
      title={ReportsConfigWidget.localization.getLocalizedString(
        "ReportsConfigWidget:AddMappings"
      )}
      isOpen={show}
      isDismissible={!isLoading}
      onClose={async () => {
        await returnFn();
      }}
      style={{ display: "flex", flexDirection: "column", maxHeight: "77vh" }}
    >
      <div className="add-mappings-container">
        <SelectIModel
          selectedIModelId={selectedIModelId}
          setSelectedIModelId={setSelectediModelId}
        />
        <Table<MappingType>
          data={isLoading ? [] : mappings}
          columns={mappingsColumns}
          className="add-mappings-table"
          emptyTableContent={ReportsConfigWidget.localization.getLocalizedString(
            "ReportsConfigWidget:NoMappingsAvailable"
          )}
          isSortable
          isSelectable
          isLoading={isLoading}
          isRowDisabled={(rowData) =>
            existingMappings.some((v) => v.mappingId === rowData.id)
          }
          onSelect={(selectData: Mapping[] | undefined) => {
            selectData && setSelectedMappings(selectData);
          }}
          paginatorRenderer={LocalizedTablePaginator}
        />
      </div>
      <ActionPanel
        actionLabel={ReportsConfigWidget.localization.getLocalizedString(
          "ReportsConfigWidget:Add"
        )}
        onAction={onSave}
        onCancel={returnFn}
        isSavingDisabled={selectedMappings.length === 0}
        isLoading={isLoading}
      />
    </Modal>
  );
};

export default AddMappingsModal;
