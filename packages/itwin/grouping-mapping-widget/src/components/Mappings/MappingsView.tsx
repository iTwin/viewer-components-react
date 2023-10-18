/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import React from "react";
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
  SvgRefresh,
} from "@itwin/itwinui-icons-react";
import {
  EmptyMessage,
  LoadingOverlay,
} from "../SharedComponents/utils";
import "./MappingsView.scss";
import DeleteModal from "../SharedComponents/DeleteModal";
import { MappingImportWizardModal } from "./Import/MappingImportWizardModal";
import { HorizontalTile } from "../SharedComponents/HorizontalTile";
import type { Mapping } from "@itwin/insights-client";
import { BlockingOverlay } from "./BlockingOverlay";
import { MappingUIActionGroup } from "./MappingViewActionGroup";
import type { ExtractionMessageData } from "./hooks/useMappingsOperations";
import type { ExtractionIconData } from "./hooks/useMappingsOperations";
import { ExtractionStatusIcon } from "./Extraction/ExtractionStatusIcon";
import { ExtractionMessageModal } from "./Extraction/ExtractionMessageModal";

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
  extractionIconData: ExtractionIconData;
  showExtractionMessageModal: boolean;
  extractionMessageData: ExtractionMessageData[];
  setShowExtractionMessageModal: (show: boolean) => void;
  isTogglingExtraction: boolean;
  onRefresh: () => Promise<void>;
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
}

export const MappingsView = ({
  mappings,
  isLoading,
  extractionIconData,
  showExtractionMessageModal,
  extractionMessageData,
  setShowExtractionMessageModal,
  isTogglingExtraction,
  onRefresh,
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
          </div>
          <div className="gmw-button-spacing">
            <ExtractionStatusIcon
              iconStatus={extractionIconData.iconStatus}
              onClick={() => {
                if (extractionIconData.iconStatus === "negative") {
                  setShowExtractionMessageModal(true);
                }
              }}
              iconMessage={extractionIconData.iconMessage}
            />
            <IconButton
              title="Refresh"
              onClick={onRefresh}
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
              <HorizontalTile
                key={mapping.id}
                title={mapping.mappingName ? mapping.mappingName : "Untitled"}
                subText={mapping.description ?? ""}
                subtextToolTip={mapping.description ?? ""}
                titleTooltip={mapping.mappingName}
                onClickTitle={onClickMappingTitle ? () => onClickMappingTitle(mapping) : undefined}
                actionGroup={
                  <MappingUIActionGroup
                    mapping={mapping}
                    onToggleExtraction={onToggleExtraction}
                    onRefresh={onRefresh}
                    onClickMappingModify={onClickMappingModify}
                    setShowDeleteModal={setShowDeleteModal}
                  />
                }
              />
            ))}
          </div>
        )}
      </div>
      <ExtractionMessageModal
        isOpen={showExtractionMessageModal}
        onClose={() => setShowExtractionMessageModal(false)}
        extractionMessageData={extractionMessageData}
        timestamp={extractionMessageData.length === 0 ? "" : extractionMessageData[0].date}
      />
      {showDeleteModal &&
        <DeleteModal
          entityName={showDeleteModal?.mappingName}
          onClose={() => setShowDeleteModal(undefined)}
          onDelete={async () => {
            await onDelete(showDeleteModal);
          }}
          refresh={onRefresh}
        />
      }
      {showImportModal && setShowImportModal && <MappingImportWizardModal
        show={showImportModal}
        setShow={setShowImportModal}
        onFinish={onRefresh}
        displayStrings={displayStrings}
      />}
    </>
  );
};
