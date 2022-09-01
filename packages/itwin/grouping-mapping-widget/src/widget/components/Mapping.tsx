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
  DropdownMenu,
  IconButton,
  MenuItem,
  Surface,
} from "@itwin/itwinui-react";
import React, { useCallback, useEffect, useState } from "react";
import type { CreateTypeFromInterface } from "../utils";
import { EmptyMessage, handleError, LoadingOverlay, onSelectionChanged, WidgetHeader } from "./utils";
import "./Mapping.scss";
import DeleteModal from "./DeleteModal";
import { Groupings } from "./Grouping";
import MappingAction from "./MappingAction";
import { MappingImportWizardModal } from "./MappingImportWizardModal";
import { useMappingClient } from "./context/MappingClientContext";
import type { IMappingsClient, Mapping } from "@itwin/insights-client";
import { BlockingOverlay } from "./BlockingOverlay";
import { HorizontalTile } from "./HorizontalTile";
import { clearAll } from "./viewerUtils";
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
  mappingsClient: IMappingsClient,
) => {
  try {
    setIsLoading(true);
    const accessToken = await getAccessToken();
    const mappings = await mappingsClient.getMappings(accessToken, iModelId);
    setMappings(mappings);
  } catch (error: any) {
    handleError(error.status);
  } finally {
    setIsLoading(false);
  }
};

const toggleExtraction = async (
  getAccessToken: GetAccessTokenFn,
  mappingsClient: IMappingsClient,
  iModelId: string,
  mapping: Mapping
) => {
  try {
    const newState = mapping.extractionEnabled;
    const accessToken = await getAccessToken();
    await mappingsClient.updateMapping(
      accessToken,
      iModelId,
      mapping.id,
      { extractionEnabled: newState }
    );
  } catch (error: any) {
    handleError(error.status);
  }
};

export const Mappings = () => {
  const { getAccessToken } = useGroupingMappingApiConfig();
  const mappingClient = useMappingClient();
  const iModelId = useActiveIModelConnection()?.iModelId as string;
  const [showDeleteModal, setShowDeleteModal] = useState<boolean>(false);
  const [showImportModal, setShowImportModal] = useState<boolean>(false);
  const [showBlockingOverlay, setShowBlockingOverlay] = useState<boolean>(false);
  const [mappingView, setMappingView] = useState<MappingView>(
    MappingView.MAPPINGS
  );
  const [selectedMapping, setSelectedMapping] = useState<Mapping | undefined>(undefined);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [mappings, setMappings] = useState<Mapping[]>([]);

  useEffect(() => {
    void fetchMappings(setMappings, iModelId, setIsLoading, getAccessToken, mappingClient);
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
    await fetchMappings(setMappings, iModelId, setIsLoading, getAccessToken, mappingClient);
  }, [getAccessToken, mappingClient, iModelId, setMappings]);

  const addMapping = async () => {
    setMappingView(MappingView.ADDING);
  };

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
          <BlockingOverlay isVisible={showBlockingOverlay} />
          <WidgetHeader title="Mappings" />
          <Surface className="gmw-mappings-container">
            <div className="gmw-table-toolbar">
              <div className="gmw-button-spacing">
                <Button
                  startIcon={<SvgAdd />}
                  onClick={async () => addMapping()}
                  styleType="high-visibility"
                >
                  New
                </Button>
                <IconButton title="Import Mappings"
                  onClick={() => setShowImportModal(true)}>
                  <SvgImport />
                </IconButton>
              </div>
            </div>
            {isLoading ? (
              <LoadingOverlay />
            ) : mappings.length === 0 ? (
              <EmptyMessage message="No Mappings available." />
            ) : (
              <div className="gmw-mappings-list">
                {mappings
                  .sort((a, b) => a.mappingName.localeCompare(b.mappingName) ?? 1)
                  .map((mapping) => (
                    <HorizontalTile
                      key={mapping.id}
                      title={mapping.mappingName ? mapping.mappingName : "Untitled"}
                      subText={mapping.description ?? ""}
                      subtextToolTip={mapping.description ?? ""}
                      titleTooltip={mapping.mappingName}
                      onClickTitle={() => {
                        setSelectedMapping(mapping);
                        setMappingView(MappingView.GROUPS);
                      }}
                      actionGroup={
                        <DropdownMenu
                          menuItems={(close: () => void) => [
                            <MenuItem
                              key={0}
                              onClick={() => {
                                setSelectedMapping(mapping);
                                setMappingView(MappingView.MODIFYING);
                              }}
                              icon={<SvgEdit />}
                            >
                              Modify
                            </MenuItem>,
                            <MenuItem
                              key={1}
                              onClick={async () => {
                                setSelectedMapping(mapping);
                                setShowBlockingOverlay(true);
                                close();
                                await toggleExtraction(getAccessToken, mappingClient, iModelId, mapping);
                                await refresh();
                                setShowBlockingOverlay(false);
                              }}
                              icon={<SvgProcess />}
                            >
                              {mapping.extractionEnabled ? "Disable extraction" : "Enable extraction"}
                            </MenuItem>,
                            <MenuItem
                              key={2}
                              onClick={() => {
                                setSelectedMapping(mapping);
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
                      }
                    />
                  ))}
              </div>
            )}
          </Surface>
          <DeleteModal
            entityName={selectedMapping?.mappingName ?? ""}
            show={showDeleteModal}
            setShow={setShowDeleteModal}
            onDelete={async () => {
              const accessToken = await getAccessToken();
              await mappingClient.deleteMapping(
                accessToken,
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
