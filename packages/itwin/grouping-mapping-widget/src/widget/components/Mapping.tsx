/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { Presentation } from "@itwin/presentation-frontend";
import { useActiveIModelConnection } from "@itwin/appui-react";
import {
  SvgAdd,
  SvgDelete,
  SvgEdit,
  SvgImport,
  SvgMore,
} from "@itwin/itwinui-icons-react";
import {
  Button,
  ButtonGroup,
  DropdownMenu,
  IconButton,
  MenuItem,
  Table,
} from "@itwin/itwinui-react";
import type { CellProps } from "react-table";
import React, { useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { CreateTypeFromInterface } from "../utils";
import { handleError, onSelectionChanged, WidgetHeader } from "./utils";
import "./Mapping.scss";
import DeleteModal from "./DeleteModal";
import { Groupings } from "./Grouping";
import MappingAction from "./MappingAction";
import { MappingImportWizardModal } from "./MappingImportWizardModal";
import type { Api } from "./GroupingMapping";
import { ApiContext } from "./GroupingMapping";
import type { Mapping } from "@itwin/insights-client";
import { ReportingClient } from "@itwin/insights-client";

export type MappingType = CreateTypeFromInterface<Mapping>;

enum MappingView {
  MAPPINGS = "mappings",
  GROUPS = "groups",
  ADDING = "adding",
  MODIFYING = "modifying",
  IMPORT = "import",
}

const fetchMappings = async (
  setMappings: React.Dispatch<React.SetStateAction<Mapping[]>>,
  iModelId: string,
  setIsLoading: React.Dispatch<React.SetStateAction<boolean>>,
  apiContext: Api
) => {
  try {
    setIsLoading(true);
    const reportingClientApi = new ReportingClient(apiContext.prefix);
    const mappings = await reportingClientApi.getMappings(apiContext.accessToken, iModelId);
    setMappings(mappings);
  } catch (error: any) {
    handleError(error.status);
  } finally {
    setIsLoading(false);
  }
};

export const Mappings = () => {
  const apiContext = useContext(ApiContext);
  const iModelId = useActiveIModelConnection()?.iModelId as string;
  const [showDeleteModal, setShowDeleteModal] = useState<boolean>(false);
  const [showImportModal, setShowImportModal] = useState<boolean>(false);
  const [mappingView, setMappingView] = useState<MappingView>(
    MappingView.MAPPINGS
  );
  const [selectedMapping, setSelectedMapping] = useState<
  Mapping | undefined
  >(undefined);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [mappings, setMappings] = useState<Mapping[]>([]);

  useEffect(() => {
    void fetchMappings(setMappings, iModelId, setIsLoading, apiContext);
  }, [apiContext, iModelId, setIsLoading]);

  useEffect(() => {
    const removeListener =
      Presentation.selection.selectionChange.addListener(onSelectionChanged);
    return () => {
      removeListener();
    };
  }, []);

  const refresh = useCallback(async () => {
    setMappingView(MappingView.MAPPINGS);
    setSelectedMapping(undefined);
    setMappings([]);
    await fetchMappings(setMappings, iModelId, setIsLoading, apiContext);
  }, [apiContext, iModelId, setMappings]);

  const addMapping = async () => {
    setMappingView(MappingView.ADDING);
  };

  const mappingsColumns = useMemo(
    () => [
      {
        Header: "Table",
        columns: [
          {
            id: "mappingName",
            Header: "Mapping Name",
            accessor: "mappingName",
            Cell: (value: CellProps<{ mappingName: string }>) => (
              <div
                className="iui-anchor"
                onClick={() => {
                  setSelectedMapping(value.row.original);
                  setMappingView(MappingView.GROUPS);
                }}
              >
                {value.row.original.mappingName}
              </div>
            ),
          },
          {
            id: "description",
            Header: "Description",
            accessor: "description",
          },
          {
            id: "dropdown",
            Header: "",
            width: 80,
            Cell: (value: CellProps<MappingType>) => {
              return (
                <DropdownMenu
                  menuItems={(close: () => void) => [
                    <MenuItem
                      key={0}
                      onClick={() => {
                        setSelectedMapping(value.row.original);
                        setMappingView(MappingView.MODIFYING);
                      }}
                      icon={<SvgEdit />}
                    >
                      Modify
                    </MenuItem>,

                    <MenuItem
                      key={1}
                      onClick={() => {
                        setSelectedMapping(value.row.original);
                        setShowDeleteModal(true);
                        close();
                      }}
                      icon={<SvgDelete />}
                    >
                      Remove
                    </MenuItem>,
                  ]}
                >
                  <IconButton styleType="borderless">
                    <SvgMore
                      style={{
                        width: "16px",
                        height: "16px",
                      }}
                    />
                  </IconButton>
                </DropdownMenu>
              );
            },
          },
        ],
      },
    ],
    []
  );

  switch (mappingView) {
    case MappingView.ADDING:
      return <MappingAction iModelId={iModelId} returnFn={refresh} />;
    case MappingView.MODIFYING:
      return (
        <MappingAction
          iModelId={iModelId}
          mapping={selectedMapping}
          returnFn={refresh}
        />
      );
    case MappingView.GROUPS:
      return (
        <Groupings
          mapping={selectedMapping as Mapping}
          goBack={refresh}
        />
      );
    default:
      return (
        <>
          <WidgetHeader title="Mappings" />
          <div className="mappings-container">
            <div className="table-toolbar">
              <Button
                startIcon={<SvgAdd />}
                onClick={async () => addMapping()}
                styleType="high-visibility"
              >
                New
              </Button>
              <ButtonGroup onClick={() => setShowImportModal(true)}>
                <IconButton title="Import Mappings">
                  <SvgImport />
                </IconButton>
              </ButtonGroup>
            </div>
            <Table<MappingType>
              data={mappings}
              density="extra-condensed"
              columns={mappingsColumns}
              emptyTableContent="No Mappings available."
              isSortable
              isLoading={isLoading}
            />
          </div>
          <DeleteModal
            entityName={selectedMapping?.mappingName ?? ""}
            show={showDeleteModal}
            setShow={setShowDeleteModal}
            onDelete={async () => {
              const reportingClientApi = new ReportingClient(apiContext.prefix);
              await reportingClientApi.deleteMapping(
                apiContext.accessToken,
                iModelId,
                selectedMapping?.id ?? ""
              );
            }}
            refresh={refresh}
          />
          <MappingImportWizardModal
            show={showImportModal}
            setShow={setShowImportModal}
            onFinish={refresh}
          />
        </>
      );
  }
};
