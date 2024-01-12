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
import { MappingHorizontalTile } from "./MappingList";
import type { ExtractionMessageData } from "./Extraction/ExtractionMessageModal";
import { ExtractionMessageModal } from "./Extraction/ExtractionMessageModal";
import { BeEvent } from "@itwin/core-bentley";
import { useFetchExtractionStates } from "./hooks/useFetchExtractionStates";
import { useGroupingMappingApiConfig } from "../context/GroupingApiConfigContext";

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
  onRunExtraction: (mappings: Mapping[]) => Promise<void>;
  alert?: React.ReactElement<typeof Alert>;
}

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
  onRunExtraction,
  alert,
}: MappingsViewProps) => {
  const displayStrings = React.useMemo(
    () => ({ ...mappingViewDefaultDisplayStrings, ...userDisplayStrings }),
    [userDisplayStrings]
  );

  const [selectedMappings, setSelectedMappings] = useState<Mapping[]>([]);

  const jobStartEvent = useMemo(
    () => new BeEvent<(mappingId: string) => void>(),
    []
  );

  const refreshAll = useCallback(async () => {
    await Promise.all([onRefreshMappings(), onRefreshExtractionStatus()]);
  }, [onRefreshMappings, onRefreshExtractionStatus]);

  const onSelectionChange = (mapping: Mapping) => {
    setSelectedMappings((mappingIdList) =>
      mappingIdList.some((eachId) => mapping.id === eachId.id)
        ? mappingIdList.filter((eachId) => mapping.id !== eachId.id)
        : [...mappingIdList, mapping]
    );
  }

  const runExtraction = useCallback(async () => {
    await onRunExtraction(selectedMappings);
    selectedMappings.map((mapping) => { jobStartEvent.raiseEvent(mapping.id) });
    setSelectedMappings([]);
  }, [selectedMappings, jobStartEvent]);

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
              onClick={runExtraction}
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
          <div className="gmw-mappings-list">
            {mappings.map((mapping) => (
              <MappingHorizontalTile
                key={mapping.id}
                mapping={mapping}
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
          </div>
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
