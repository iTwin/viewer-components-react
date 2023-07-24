/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import React from "react";
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
} from "./utils";
import "./MappingsUI.scss";
import DeleteModal from "./DeleteModal";
import { MappingImportWizardModal } from "./MappingImportWizardModal";
import { HorizontalTile } from "./HorizontalTile";
import type { Mapping } from "@itwin/insights-client";
import { BlockingOverlay } from "./BlockingOverlay";
import { MappingUIActionGroup } from "./MappingUIActionGroup";

export const mappingUIDefaultDisplayStrings = {
  mappings: "Mappings",
  iTwins: "iTwins",
  iTwinNumber: "Number",
  iTwinName: "Name",
  iTwinStatus: "Status",
  iModels: "iModels",
  iModelName: "Name",
  iModelDescription: "Description",
};

export interface MappingsUIProps {
  mappings: Mapping[];
  isLoading: boolean;
  isTogglingExtraction: boolean;
  onRefresh: () => Promise<void>;
  onToggleExtraction: (mapping: Mapping) => Promise<void>;
  onDelete: (mapping: Mapping) => Promise<void>;
  showDeleteModal: Mapping | undefined;
  setShowDeleteModal: (mapping?: Mapping) => void;
  displayStrings?: Partial<typeof mappingUIDefaultDisplayStrings>;
  showImportModal?: boolean;
  setShowImportModal?: (show: boolean) => void;
  onClickAddMapping?: () => void;
  onClickMappingTitle?: (mapping: Mapping) => void;
  onClickMappingModify?: (mapping: Mapping) => void;
}

export const MappingsUI = ({
  mappings,
  isLoading,
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
}: MappingsUIProps) => {
  const displayStrings = React.useMemo(
    () => ({ ...mappingUIDefaultDisplayStrings, ...userDisplayStrings }),
    [userDisplayStrings]
  );

  return (
    <>
      <BlockingOverlay isVisible={isTogglingExtraction} />
      <div className="gmw-mappings-container">
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
            {showImportModal && setShowImportModal && <IconButton
              title={`Import ${displayStrings.mappings}`}
              onClick={() => setShowImportModal(true)}
            >
              <SvgImport />
            </IconButton>
            }
          </div>
          <IconButton
            title="Refresh"
            onClick={onRefresh}
            disabled={isLoading}
            styleType='borderless'
          >
            <SvgRefresh />
          </IconButton>
        </div>
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
