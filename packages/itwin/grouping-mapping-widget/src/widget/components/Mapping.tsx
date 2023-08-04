/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import {
  SvgAdd,
  SvgDelete,
  SvgEdit,
  SvgImport,
  SvgMore,
  SvgProcess,
  SvgRefresh,
} from "@itwin/itwinui-icons-react";
import {
  Button,
  DropdownMenu,
  IconButton,
  MenuItem,
} from "@itwin/itwinui-react";
import React, { useCallback, useEffect, useState } from "react";
import {
  EmptyMessage,
  handleError,
  LoadingOverlay,
} from "./utils";
import "./Mapping.scss";
import DeleteModal from "./DeleteModal";
import { MappingImportWizardModal } from "./MappingImportWizardModal";
import { useMappingClient } from "./context/MappingClientContext";
import type { IExtractionClient, IMappingsClient, Mapping } from "@itwin/insights-client";
import { BlockingOverlay } from "./BlockingOverlay";
import { HorizontalTile } from "./HorizontalTile";
import type { GetAccessTokenFn } from "./context/GroupingApiConfigContext";
import { useGroupingMappingApiConfig } from "./context/GroupingApiConfigContext";
import type { CreateTypeFromInterface } from "../utils";
import { useExtractionClient } from "./context/ExtractionClientContext";
import { ExtractionStatusIcon } from "./ExtractionStatusIcon";
import { ExtractionMessageModal } from "./ExtractionMessageModal";

export type IMappingTyped = CreateTypeFromInterface<Mapping>;

const defaultDisplayStrings = {
  mappings: "Mappings",
  iTwins: "iTwins",
  iTwinNumber: "Number",
  iTwinName: "Name",
  iTwinStatus: "Status",
  iModels: "iModels",
  iModelName: "Name",
  iModelDescription: "Description",
};
export interface MappingsProps {
  onClickAddMapping?: () => void;
  onClickMappingTitle?: (mapping: Mapping) => void;
  onClickMappingModify?: (mapping: Mapping) => void;
  displayStrings?: Partial<typeof defaultDisplayStrings>;
}

export interface ExtractionMessageData {
  date: string;
  catagory: string;
  level: string;
  message: string;
}

const fetchExtractionStatus = async (
  iModelId: string,
  getAccessToken: GetAccessTokenFn,
  extractionClient: IExtractionClient,
  setIconStatus: React.Dispatch<React.SetStateAction<"negative" | "positive" | "warning">>,
  setIconMessage: React.Dispatch<React.SetStateAction<string>>,
  setExtractionMessageData: React.Dispatch<React.SetStateAction<ExtractionMessageData[]>>
) => {
  setIconStatus("warning");
  setIconMessage("Extraction status pending.");
  try {
    const accessToken = await getAccessToken();
    const extractions = await extractionClient.getExtractionHistory(accessToken, iModelId);
    const jobId = extractions[0].jobId;
    const status = await extractionClient.getExtractionStatus(accessToken, jobId);
    if (status.containsIssues) {
      setIconStatus("negative");
      setIconMessage("Extraction contains issues. Click to view extraction logs.");
      let logs = await extractionClient.getExtractionLogs(accessToken, jobId);
      logs = logs.filter((log) => log.message != null);
      const extractionMessageData = logs.map((log) =>
        (
          {
            date: log.dateTime,
            catagory: log.category,
            level: log.level,
            message: String(log.message),
          }
        ));
      setExtractionMessageData(extractionMessageData);
    } else {
      setIconStatus("positive");
      setIconMessage("Extraction Successful.");
    }
  } catch (error: any) { }
};

const fetchMappings = async (
  setMappings: React.Dispatch<React.SetStateAction<Mapping[]>>,
  iModelId: string,
  setIsLoading: React.Dispatch<React.SetStateAction<boolean>>,
  getAccessToken: GetAccessTokenFn,
  mappingsClient: IMappingsClient
) => {
  try {
    setIsLoading(true);
    const accessToken = await getAccessToken();
    const mappings = await mappingsClient.getMappings(accessToken, iModelId);
    setMappings(mappings.sort((a, b) => a.mappingName.localeCompare(b.mappingName)));
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
    const newState = !mapping.extractionEnabled;
    const accessToken = await getAccessToken();
    await mappingsClient.updateMapping(accessToken, iModelId, mapping.id, {
      extractionEnabled: newState,
    });
  } catch (error: any) {
    handleError(error.status);
  }
};

export const Mappings = ({
  onClickAddMapping,
  onClickMappingTitle,
  onClickMappingModify,
  displayStrings: userDisplayStrings,
}: MappingsProps) => {
  const { getAccessToken, iModelId } = useGroupingMappingApiConfig();
  const mappingClient = useMappingClient();
  const extractionClient = useExtractionClient();
  const [showDeleteModal, setShowDeleteModal] = useState<Mapping | undefined>(undefined);
  const [showImportModal, setShowImportModal] = useState<boolean>(false);
  const [showBlockingOverlay, setShowBlockingOverlay] =
    useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [mappings, setMappings] = useState<Mapping[]>([]);
  const [iconStatus, setIconStatus] = useState<"negative" | "positive" | "warning">("warning");
  const [iconMessage, setIconMessage] = useState<string>("");
  const [showExtractionMessageModal, setShowExtractionMessageModal] = useState<boolean>(false);
  const [extractionMessageData, setExtractionMessageData] = useState<ExtractionMessageData[]>([]);
  const displayStrings = React.useMemo(
    () => ({ ...defaultDisplayStrings, ...userDisplayStrings }),
    [userDisplayStrings]
  );

  useEffect(() => {
    void fetchExtractionStatus(
      iModelId,
      getAccessToken,
      extractionClient,
      setIconStatus,
      setIconMessage,
      setExtractionMessageData
    );
  }, [iModelId, getAccessToken, extractionClient]);

  useEffect(() => {
    void fetchMappings(
      setMappings,
      iModelId,
      setIsLoading,
      getAccessToken,
      mappingClient
    );
  }, [getAccessToken, mappingClient, iModelId, setIsLoading]);

  const refresh = useCallback(async () => {
    setMappings([]);
    await fetchMappings(
      setMappings,
      iModelId,
      setIsLoading,
      getAccessToken,
      mappingClient
    );
  }, [getAccessToken, mappingClient, iModelId, setMappings]);

  return (
    <>
      <BlockingOverlay isVisible={showBlockingOverlay} />
      <div className="gmw-mappings-container">
        <div className="gmw-table-toolbar">
          <div className="gmw-button-spacing">
            {onClickAddMapping &&
              <Button
                startIcon={<SvgAdd />}
                onClick={onClickAddMapping}
                styleType="high-visibility"
                title='New Mapping'
              >
                New
              </Button>
            }
            <IconButton
              title={`Import ${displayStrings.mappings}`}
              onClick={() => setShowImportModal(true)}
            >
              <SvgImport />
            </IconButton>
          </div>
          <div className="gmw-button-spacing">
            <ExtractionStatusIcon
              iconStatus={iconStatus}
              onClick={() => {
                if (iconStatus === "negative") {
                  setShowExtractionMessageModal(true);
                }
              }}
              iconMessage={iconMessage}
            />
            <IconButton
              title="Refresh"
              onClick={refresh}
              disabled={isLoading}
              styleType='borderless'
            >
              <SvgRefresh />
            </IconButton>
          </div>
        </div>
        {isLoading ? (
          <LoadingOverlay />
        ) : mappings.length === 0 ? (
          <EmptyMessage message={`No ${displayStrings.mappings} available.`} />
        ) : (
          <div className="gmw-mappings-list">
            {mappings
              .map((mapping) => (
                <HorizontalTile
                  key={mapping.id}
                  title={
                    mapping.mappingName ? mapping.mappingName : "Untitled"
                  }
                  subText={mapping.description ?? ""}
                  subtextToolTip={mapping.description ?? ""}
                  titleTooltip={mapping.mappingName}
                  onClickTitle={onClickMappingTitle ? () => onClickMappingTitle(mapping) : undefined}
                  actionGroup={
                    <DropdownMenu
                      menuItems={(close: () => void) => [
                        onClickMappingModify ? (
                          <MenuItem
                            key={0}
                            onClick={() => {
                              onClickMappingModify(mapping);
                              close();
                            }}
                            icon={<SvgEdit />}
                          >
                            Modify
                          </MenuItem>
                        ) : [],
                        <MenuItem
                          key={1}
                          onClick={async () => {
                            setShowBlockingOverlay(true);
                            close();
                            await toggleExtraction(
                              getAccessToken,
                              mappingClient,
                              iModelId,
                              mapping
                            );
                            await refresh();
                            setShowBlockingOverlay(false);
                          }}
                          icon={<SvgProcess />}
                        >
                          {mapping.extractionEnabled
                            ? "Disable extraction"
                            : "Enable extraction"}
                        </MenuItem>,
                        <MenuItem
                          key={2}
                          onClick={() => {
                            setShowDeleteModal(mapping);
                            close();
                          }}
                          icon={<SvgDelete />}
                        >
                          Remove
                        </MenuItem>,
                      ].flatMap((m) => m)}
                    >
                      <IconButton styleType="borderless" title='Mapping Options'>
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
      </div >
      <ExtractionMessageModal
        isOpen={showExtractionMessageModal}
        onClose={() => setShowExtractionMessageModal(false)}
        extractionMessageData={extractionMessageData}
      />
      <DeleteModal
        entityName={showDeleteModal?.mappingName}
        onClose={() => setShowDeleteModal(undefined)}
        onDelete={async () => {
          const accessToken = await getAccessToken();
          await mappingClient.deleteMapping(
            accessToken,
            iModelId,
            showDeleteModal?.id ?? ""
          );
        }}
        refresh={refresh}
      />
      <MappingImportWizardModal
        show={showImportModal}
        setShow={setShowImportModal}
        onFinish={refresh}
        displayStrings={displayStrings}
      />
    </>
  );
};
