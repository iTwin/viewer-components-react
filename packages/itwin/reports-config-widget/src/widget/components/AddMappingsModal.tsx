/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { IModelApp } from "@itwin/core-frontend";
import {
  Modal,
  ModalContent,
} from "@itwin/itwinui-react";
import {
  Table,
  tableFilters,
} from "@itwin/itwinui-react";
import React, { useContext, useEffect, useMemo, useState } from "react";
import type { Mapping } from "../../reporting";
import { ReportingClient } from "../../reporting/reportingClient";
import ActionPanel from "./ActionPanel";
import "./AddMappingsModal.scss";
import { LocalizedTablePaginator } from "./LocalizedTablePaginator";
import type { ReportMappingAndMapping } from "./ReportMappings";
import { AccessTokenContext } from "./ReportsContainer";
import { SelectIModel } from "./SelectIModel";
import type { CreateTypeFromInterface } from "./utils";
import { handleError } from "./utils";

export type MappingType = CreateTypeFromInterface<Mapping>;

const fetchMappings = async (
  setMappings: React.Dispatch<React.SetStateAction<Mapping[]>>,
  iModelId: string,
  setIsLoading: React.Dispatch<React.SetStateAction<boolean>>,
  accessToken: string
) => {
  try {
    setIsLoading(true);
    const reportingClientApi = new ReportingClient();
    const mappings = await reportingClientApi.getMappings(accessToken, iModelId);
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
  const accessToken = useContext(AccessTokenContext);

  useEffect(() => {
    if (selectedIModelId) {
      void fetchMappings(setMappings, selectedIModelId, setIsLoading, accessToken);
    }
  }, [accessToken, selectedIModelId, setIsLoading]);

  const mappingsColumns = useMemo(
    () => [
      {
        Header: "Table",
        columns: [
          {
            id: "mappingName",
            Header: IModelApp.localization.getLocalizedString("ReportsConfigWidget:MappingName"),
            accessor: "mappingName",
            Filter: tableFilters.TextFilter(),
          },
          {
            id: "description",
            Header: IModelApp.localization.getLocalizedString("ReportsConfigWidget:Description"),
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
      const reportingClientApi = new ReportingClient();
      for (const mapping of selectedMappings) {
        await reportingClientApi.createReportMapping(accessToken, reportId, { imodelId: selectedIModelId, mappingId: mapping.id ?? "" });
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
      title={IModelApp.localization.getLocalizedString("ReportsConfigWidget:AddMappings")}
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
            emptyTableContent={IModelApp.localization.getLocalizedString("ReportsConfigWidget:NoMappingsAvailable")}
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
        actionLabel={IModelApp.localization.getLocalizedString("ReportsConfigWidget:Add")}
        onAction={onSave}
        onCancel={returnFn}
        isSavingDisabled={selectedMappings.length === 0}
        isLoading={isLoading}
      />
    </Modal>
  );
};

export default AddMappingsModal;
