/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { useActiveIModelConnection } from "@itwin/appui-react";
import { IModelApp } from "@itwin/core-frontend";
import { AccessTokenAdapter } from "@itwin/imodels-access-frontend";
import type { MinimalIModel } from "@itwin/imodels-client-management";
import { GetIModelListParams, IModelsClient, toArray } from "@itwin/imodels-client-management";
import {
  Modal,
  ModalContent,
  TablePaginatorRendererProps,
} from "@itwin/itwinui-react";
import {
  Button,
  Table,
  tableFilters,
  TablePaginator,
} from "@itwin/itwinui-react";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import type { Mapping } from "../../reporting";
import { ReportingClient } from "../../reporting/reportingClient";
import ActionPanel from "./ActionPanel";
import "./AddMappingsModal.scss";
import { LocalizedTablePaginator } from "./LocalizedTablePaginator";
import type { ReportMappingAndMapping } from "./ReportMappings";
import { SelectIModel } from "./SelectIModel";
import type { CreateTypeFromInterface } from "./utils";
import { handleError, WidgetHeader } from "./utils";

export type MappingType = CreateTypeFromInterface<Mapping>;

const fetchMappings = async (
  setMappings: React.Dispatch<React.SetStateAction<Mapping[]>>,
  iModelId: string,
  setIsLoading: React.Dispatch<React.SetStateAction<boolean>>
) => {
  try {
    setIsLoading(true);
    const accessToken = (await IModelApp.authorizationClient?.getAccessToken()) ?? "";
    const reportingClientApi = new ReportingClient();
    const mappings = await reportingClientApi.getMappings(accessToken, iModelId);
    setMappings(mappings);
  } catch (error: any) {
    handleError(error.status);
  } finally {
    setIsLoading(false);
  }
};

const useFetchMappings = (
  selectedIModelId: string,
  setIsLoading: React.Dispatch<React.SetStateAction<boolean>>
): [
    Mapping[],
    React.Dispatch<React.SetStateAction<Mapping[]>>
  ] => {
  const [mappings, setMappings] = useState<Mapping[]>([]);
  useEffect(() => {
    if (selectedIModelId) {
      void fetchMappings(setMappings, selectedIModelId, setIsLoading);
    }
  }, [selectedIModelId, setIsLoading]);

  return [mappings, setMappings];
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
  const [mappings] = useFetchMappings(selectedIModelId, setIsLoading);

  const mappingsColumns = useMemo(
    () => [
      {
        Header: "Table",
        columns: [
          {
            id: "mappingName",
            Header: IModelApp.localization.getLocalizedString("ReportsWidget:MappingName"),
            accessor: "mappingName",
            Filter: tableFilters.TextFilter(),
          },
          {
            id: "description",
            Header: IModelApp.localization.getLocalizedString("ReportsWidget:Description"),
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
      const accessToken = (await IModelApp.authorizationClient?.getAccessToken()) ?? "";
      const reportingClientApi = new ReportingClient();
      for (const mapping of selectedMappings) {
        await reportingClientApi.createReportMapping(accessToken, reportId, { imodelId: selectedIModelId, mappingId: mapping.id ?? "" });
      }

      await returnFn();
    } catch (error: any) {
      handleError(error.status);
    }
    finally {
      setIsLoading(false);
    }
  };

  return (
    <Modal
      title={IModelApp.localization.getLocalizedString("ReportsWidget:AddMappings")}
      isOpen={show}
      isDismissible={!isLoading}
      onClose={async () => {
        await returnFn();
      }}
    >
      <ModalContent>
        <div className='add-mappings-container'>
          <SelectIModel selectedIModelId={selectedIModelId} setSelectedIModelId={setSelectediModelId} />
          <Table<MappingType>
            data={isLoading ? [] : mappings}
            columns={mappingsColumns}
            className='add-mappings-table'
            density="extra-condensed"
            emptyTableContent={IModelApp.localization.getLocalizedString("ReportsWidget:NoMappingsAvailable")}
            isSortable
            isSelectable
            isLoading={isLoading}
            isRowDisabled={(rowData) => existingMappings.some((v) => v.mappingId === rowData.id)}
            onSelect={(selectData: Mapping[] | undefined) => {
              selectData && setSelectedMappings(selectData);
            }}
            paginatorRenderer={LocalizedTablePaginator}
          />
        </div>
      </ModalContent>
      <ActionPanel
        actionLabel={IModelApp.localization.getLocalizedString("ReportsWidget:Add")}
        onAction={onSave}
        onCancel={returnFn}
        isSavingDisabled={selectedMappings.length === 0}
        isLoading={isLoading}
      />
    </Modal>
  );
};

export default AddMappingsModal;
