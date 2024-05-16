/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import React, { useCallback, useMemo, useState } from "react";
import type {
  Alert,
} from "@itwin/itwinui-react";
import {
  Button,
  IconButton,
  List,
} from "@itwin/itwinui-react";
import {
  SvgAdd,
  SvgImport,
  SvgPlay,
  SvgRefresh,
} from "@itwin/itwinui-icons-react";
import { EmptyMessage } from "../SharedComponents/EmptyMessage";
import { LoadingOverlay } from "../SharedComponents/LoadingOverlay";
import "./MappingsView.scss";
import DeleteModal from "../SharedComponents/DeleteModal";
import { MappingImportWizardModal } from "./Import/MappingImportWizardModal";
import type { Mapping } from "@itwin/insights-client";
import { BlockingOverlay } from "./BlockingOverlay";
import type { ExtractionStatusData } from "./Extraction/ExtractionStatusIcon";
import { ExtractionStatusIcon } from "./Extraction/ExtractionStatusIcon";
import { MappingListItem } from "./MappingListItem";
import type { ExtractionMessageData } from "./Extraction/ExtractionMessageModal";
import { ExtractionMessageModal } from "./Extraction/ExtractionMessageModal";
import { BeEvent } from "@itwin/core-bentley";
import { useExtractionStateJobContext } from "../context/ExtractionStateJobContext";
import { useGroupingMappingApiConfig } from "../context/GroupingApiConfigContext";
import { useRunExtraction } from "./hooks/useRunExtraction";

export const mappingViewDefaultDisplayStrings = {
  mappings: "Mappings",
  iTwins: "iTwins",
  iTwinNumber: "Number",
  iTwinName: "Name",
  iTwinStatus: "Status",
  iModels: "iModels",
  iModelName: "Name",
  iModelDescription: "Description",
};

/**
 * @internal
 */
export interface MappingsViewProps {
  mappings: Mapping[];
  isLoading: boolean;
  extractionStatusData: ExtractionStatusData;
  showExtractionMessageModal: boolean;
  extractionMessageData: ExtractionMessageData[];
  setShowExtractionMessageModal: (show: boolean) => void;
  isTogglingExtraction: boolean;
  onRefreshMappings: () => Promise<void>;
  onRefreshExtractionStatus: () => Promise<void>;
  onToggleExtraction: (mapping: Mapping) => Promise<void>;
  onDelete: (mapping: Mapping) => Promise<void>;
  showDeleteModal: Mapping | undefined;
  setShowDeleteModal: (mapping?: Mapping) => void;
  displayStrings?: Partial<typeof mappingViewDefaultDisplayStrings>;
  showImportModal?: boolean;
  setShowImportModal?: (show: boolean) => void;
  onClickAddMapping?: () => void;
  onClickMappingTitle?: (mapping: Mapping) => void;
  onClickMappingModify?: (mapping: Mapping) => void;
  alert?: React.ReactElement<typeof Alert>;
  initialStateExtractionFlag?: boolean;
  setInitialExtractionStateFlag?: (initialStateExtractionFlag: boolean) => void;
}

/**
 * UI Component to list mappings and handle extraction.
 * @internal
 */
export const MappingsView = ({
  mappings,
  isLoading,
  extractionStatusData,
  showExtractionMessageModal,
  extractionMessageData,
  setShowExtractionMessageModal,
  isTogglingExtraction,
  onRefreshMappings,
  onRefreshExtractionStatus,
  onToggleExtraction,
  onDelete,
  showDeleteModal,
  setShowDeleteModal,
  displayStrings: userDisplayStrings,
  showImportModal,
  setShowImportModal,
  onClickAddMapping,
  onClickMappingTitle,
  onClickMappingModify,
  alert,
}: MappingsViewProps) => {
  const displayStrings = React.useMemo(
    () => ({ ...mappingViewDefaultDisplayStrings, ...userDisplayStrings }),
    [userDisplayStrings]
  );
  const [selectedMappings, setSelectedMappings] = useState<Mapping[]>([]);
  const groupingMappingApiConfig = useGroupingMappingApiConfig();
  const { mappingIdJobInfo } = useExtractionStateJobContext();
  const { runExtraction } = useRunExtraction(groupingMappingApiConfig);

  const jobStartEvent = useMemo(
    () => new BeEvent<(mappingId: string) => void>(),
    []
  );

  const refreshAll = useCallback(async () => {
    await Promise.all([onRefreshMappings(), onRefreshExtractionStatus()]);
  }, [onRefreshMappings, onRefreshExtractionStatus]);

  const onSelectionChange = (mapping: Mapping) => {
    setSelectedMappings((mappingIdList) => {
      return mappingIdList.some((eachId) => mapping.id === eachId.id)
        ? mappingIdList.filter((eachId) => mapping.id !== eachId.id)
        : [...mappingIdList, mapping];
    }
    );
  };

  const onRunExtraction = useCallback(async () => {
    await runExtraction(selectedMappings);
    selectedMappings.map((mapping) => {
      jobStartEvent.raiseEvent(mapping.id);
    });
    setSelectedMappings([]);
  }, [selectedMappings, jobStartEvent, runExtraction]);

  return (
    <>
      <BlockingOverlay isVisible={isTogglingExtraction} />
      <div className="gmw-mappings-view-container">
        <div className="gmw-table-toolbar">
          <div className="gmw-button-spacing">
            {onClickAddMapping &&
              <Button
                startIcon={<SvgAdd />}
                onClick={onClickAddMapping}
                styleType="high-visibility"
                title="New Mapping"
              >
                New
              </Button>
            }
            {showImportModal !== undefined && setShowImportModal && <IconButton
              title={`Import ${displayStrings.mappings}`}
              onClick={() => setShowImportModal(true)}
            >
              <SvgImport />
            </IconButton>
            }
            <IconButton
              title="Run extraction"
              onClick={onRunExtraction}
              disabled={selectedMappings.length === 0}
            >
              <SvgPlay />
            </IconButton>
          </div>
          <div className="gmw-button-spacing">
            <ExtractionStatusIcon
              iconStatus={extractionStatusData.iconStatus}
              onClick={() => {
                if (extractionStatusData.iconStatus === "negative") {
                  setShowExtractionMessageModal(true);
                }
              }}
              iconMessage={extractionStatusData.iconMessage}
            />
            <IconButton
              title="Refresh"
              onClick={refreshAll}
              disabled={isLoading}
              styleType='borderless'
            >
              <SvgRefresh />
            </IconButton>
          </div>
        </div>
        {alert}
        <div className='gmw-mappings-border' />
        {isLoading ? (
          <LoadingOverlay />
        ) : mappings.length === 0 ? (
          <EmptyMessage message={`No ${displayStrings.mappings} available.`} />
        ) : (
          <List className="gmw-mappings-list">
            {mappings.map((mapping) => (
              <MappingListItem
                key={mapping.id}
                mapping={mapping}
                jobId={mappingIdJobInfo?.get(mapping.id) ?? ""}
                jobStartEvent={jobStartEvent}
                onClickMappingTitle={onClickMappingTitle}
                onSelectionChange={onSelectionChange}
                selected={selectedMappings.some(
                  (eachMapping) => mapping.id === eachMapping.id
                )}
                onToggleExtraction={onToggleExtraction}
                onRefreshMappings={onRefreshMappings}
                onClickMappingModify={onClickMappingModify}
                setShowDeleteModal={setShowDeleteModal}
              />
            ))}
          </List>
        )}
      </div>
      {showExtractionMessageModal && <ExtractionMessageModal
        isOpen={showExtractionMessageModal}
        onClose={() => setShowExtractionMessageModal(false)}
        extractionMessageData={extractionMessageData}
        timestamp={extractionMessageData.length === 0 ? "" : extractionMessageData[0].date}
      />}
      {showDeleteModal &&
        <DeleteModal
          entityName={showDeleteModal?.mappingName}
          onClose={() => setShowDeleteModal(undefined)}
          onDelete={async () => {
            await onDelete(showDeleteModal);
          }}
        />
      }
      {showImportModal && setShowImportModal && <MappingImportWizardModal
        show={showImportModal}
        setShow={setShowImportModal}
        onFinish={onRefreshMappings}
        displayStrings={displayStrings}
      />}
    </>
  );
};
