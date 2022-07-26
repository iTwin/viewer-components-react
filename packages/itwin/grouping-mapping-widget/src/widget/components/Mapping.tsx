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
  SvgProcess,
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
import React, { useCallback, useEffect, useMemo, useState } from "react";
import type { CreateTypeFromInterface, GroupExtension } from "../utils";
import { handleError, onSelectionChanged, WidgetHeader } from "./utils";
import "./Mapping.scss";
import DeleteModal from "./DeleteModal";
import { Groupings } from "./Grouping";
import MappingAction from "./MappingAction";
import { MappingImportWizardModal } from "./MappingImportWizardModal";
import { useMappingClient } from "./context/MappingClientContext";
import type { Mapping } from "@itwin/insights-client";
import { BlockingOverlay } from "./BlockingOverlay";
import { clearAll } from "./viewerUtils";
import type { IMappingClient } from "../IMappingClient";
import type { GetAccessTokenFn } from "./context/GroupingApiConfigContext";
import { useGroupingMappingApiConfig } from "./context/GroupingApiConfigContext";

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
  getAccessToken: GetAccessTokenFn,
  mappingClient: IMappingClient,
) => {
  try {
    setIsLoading(true);
    const accessToken = await getAccessToken();
    const mappings = await mappingClient.getMappings(accessToken, iModelId);
    setMappings(mappings);
  } catch (error: any) {
    handleError(error.status);
  } finally {
    setIsLoading(false);
  }
};

const toggleExtraction = async (
  getAccessToken: GetAccessTokenFn,
  mappingClient: IMappingClient,
  iModelId: string,
  mapping: Mapping,
) => {
  try {
    const newState = !mapping?.extractionEnabled;
    const accessToken = await getAccessToken();
    await mappingClient.updateMapping(
      accessToken,
      iModelId,
      mapping?.id ?? "",
      { extractionEnabled: newState },
    );
  } catch (error: any) {
    handleError(error.status);
  }
};

export interface MappingsProps {
  /**
   * Group extensions
   */
  extensions?: GroupExtension[];
  /**
   * Whether to keep default extensions
   */
  extendsDefault?: boolean;
}

export const Mappings = ({
  extensions,
  extendsDefault = true,
}: MappingsProps) => {
  const { getAccessToken } = useGroupingMappingApiConfig();
  const mappingClient = useMappingClient();
  const iModelId = useActiveIModelConnection()?.iModelId as string;
  const [showDeleteModal, setShowDeleteModal] = useState<boolean>(false);
  const [showImportModal, setShowImportModal] = useState<boolean>(false);
  const [showBlockingOverlay, setShowBlockingOverlay] =
    useState<boolean>(false);
  const [mappingView, setMappingView] = useState<MappingView>(
    MappingView.MAPPINGS,
  );
  const [selectedMapping, setSelectedMapping] = useState<Mapping | undefined>(
    undefined,
  );
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [mappings, setMappings] = useState<Mapping[]>([]);

  useEffect(() => {
    void fetchMappings(
      setMappings,
      iModelId,
      setIsLoading,
      getAccessToken,
      mappingClient,
    );
  }, [getAccessToken, mappingClient, iModelId, setIsLoading]);

  useEffect(() => {
    const removeListener =
      Presentation.selection.selectionChange.addListener(onSelectionChanged);
    return () => {
      removeListener();
    };
  }, []);

  const refresh = useCallback(async () => {
    clearAll();
    setMappingView(MappingView.MAPPINGS);
    setSelectedMapping(undefined);
    setMappings([]);
    await fetchMappings(
      setMappings,
      iModelId,
      setIsLoading,
      getAccessToken,
      mappingClient,
    );
  }, [getAccessToken, mappingClient, iModelId, setMappings]);

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
            Cell: (value: CellProps<{ mappingName: string; }>) => (
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
                      onClick={async () => {
                        setSelectedMapping(value.row.original);
                        setShowBlockingOverlay(true);
                        close();
                        await toggleExtraction(
                          getAccessToken,
                          mappingClient,
                          iModelId,
                          value.row.original,
                        );
                        await refresh();
                        setShowBlockingOverlay(false);
                      }}
                      icon={<SvgProcess />}
                    >
                      {value.row.original.extractionEnabled
                        ? "Disable extraction"
                        : "Enable extraction"}
                    </MenuItem>,

                    <MenuItem
                      key={2}
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
    [getAccessToken, mappingClient, iModelId, refresh],
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
          extensions={extensions}
          extendsDefault={extendsDefault}
          goBack={refresh}
        />
      );
    default:
      return (
        <>
          <BlockingOverlay isVisible={showBlockingOverlay} />
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
              const accessToken = await getAccessToken();
              await mappingClient.deleteMapping(
                accessToken,
                iModelId,
                selectedMapping?.id ?? "",
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
