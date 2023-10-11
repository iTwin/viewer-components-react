/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import React from "react";
import type {
  Alert,
} from "@itwin/itwinui-react";
import {
  ButtonGroup,
  IconButton,
  InformationPanelWrapper,
  ProgressLinear,
} from "@itwin/itwinui-react";
import {
  SvgRefresh,
} from "@itwin/itwinui-icons-react";
import DeleteModal from "./DeleteModal";
import "./GroupsView.scss";
import { EmptyMessage, LoadingOverlay } from "./utils";
import type { Group, Mapping } from "@itwin/insights-client";
import { GroupItem } from "./GroupItem";
import type { ContextCustomUI, GroupingCustomUI } from "./customUI/GroupingMappingCustomUI";
import { GroupsAddButton } from "./GroupsAddButton";
import { OverlappedElementsInformationPanel } from "./OverlappedElementsInformationPanel";
import type { OverlappedInfo } from "./context/GroupHilitedElementsContext";

export interface ActionButtonRendererProps {
  group: Group;
}

export type ActionButtonRenderer = (
  props: ActionButtonRendererProps
) => React.ReactNode;

export interface ProgressConfig {
  hilitedGroupsProgress?: {
    currentHilitedGroups: number;
    totalNumberOfGroups: number;
  };
  baseProgress?: number;
  maxDynamicProgress?: number;
}

export interface GroupsViewProps {
  mapping: Mapping;
  groups: Group[];
  isLoading: boolean;
  onRefresh: () => Promise<void>;
  groupUIs: GroupingCustomUI[];
  actionButtonRenderers?: ActionButtonRenderer[];
  contextUIs: ContextCustomUI[];
  onClickAddGroup?: (queryGenerationType: string) => void;
  onClickGroupTitle?: (group: Group) => void;
  onClickGroupModify?: (group: Group, queryGenerationType: string) => void;
  onClickRenderContextCustomUI?: (
    contextCustomUI: Exclude<ContextCustomUI["uiComponent"], undefined>,
    group: Group,
    displayLabel: string,
  ) => void;
  disableActions?: boolean;
  selectedGroupForDeletion?: Group;
  setSelectedGroupForDeletion: (group: Group) => void;
  onDeleteGroup: (group: Group) => Promise<void>;
  onCloseDeleteModal: () => void;
  alert?: React.ReactElement<typeof Alert>;
  setActiveOverlapInfoPanelGroup?: (activeOverlapInfoPanelGroup: Group | undefined) => void;
  activeOverlapInfoPanelGroup?: Group | undefined;
  overlappedElementsInfo?: Map<string, OverlappedInfo[]>;
  progressConfig?: ProgressConfig;
}

export const GroupsView = ({
  mapping,
  groups,
  isLoading,
  onRefresh,
  groupUIs,
  actionButtonRenderers,
  onClickAddGroup,
  onClickGroupTitle,
  onClickGroupModify,
  onClickRenderContextCustomUI,
  disableActions,
  selectedGroupForDeletion,
  onDeleteGroup,
  onCloseDeleteModal,
  setSelectedGroupForDeletion,
  contextUIs,
  alert,
  setActiveOverlapInfoPanelGroup,
  activeOverlapInfoPanelGroup,
  overlappedElementsInfo,
  progressConfig,
}: GroupsViewProps) => {
  /**
   * UX Progress Bar Logic:
   * - Start non-zero for immediate feedback.
   * - Restrict motion to a range (e.g., 25-90%) for perceived continuity.
   * - Disappear when compplete.
   * Goal: Smooth experience for unpredictable durations.
   */
  const { baseProgress = 25, maxDynamicProgress = 65, hilitedGroupsProgress } = progressConfig || {};

  return (
    <InformationPanelWrapper className="gmw-groups-container">
      <div className="gmw-toolbar">
        {onClickAddGroup && groupUIs.length > 0 && (
          <GroupsAddButton
            disabled={disableActions}
            groupUIs={groupUIs}
            onClickAddGroup={onClickAddGroup}
          />
        )}
        <ButtonGroup className="gmw-toolbar-buttons">
          <IconButton
            title="Refresh"
            onClick={onRefresh}
            disabled={isLoading || disableActions}
            styleType="borderless"
          >
            <SvgRefresh />
          </IconButton>
        </ButtonGroup>
      </div>
      {alert}
      <div className='gmw-groups-border' />
      {!!hilitedGroupsProgress &&
        <div className="gmw-group-progress-bar">
          <ProgressLinear
            value={baseProgress + (hilitedGroupsProgress.currentHilitedGroups / hilitedGroupsProgress.totalNumberOfGroups * maxDynamicProgress)}
          />
        </div>}
      {isLoading ? (
        <LoadingOverlay />
      ) : groups.length === 0 ? (
        <EmptyMessage message="No Groups available." />
      ) : (
        <div className="gmw-group-list">
          {groups.map((group) => (
            <GroupItem
              key={group.id}
              mapping={mapping}
              group={group}
              groupUIs={groupUIs}
              actionButtonRenderers={actionButtonRenderers}
              onClickGroupTitle={onClickGroupTitle}
              onClickGroupModify={onClickGroupModify}
              onClickRenderContextCustomUI={onClickRenderContextCustomUI}
              disableActions={disableActions}
              setShowDeleteModal={setSelectedGroupForDeletion}
              contextUIs={contextUIs}
              setActiveOverlapInfoPanelGroup={setActiveOverlapInfoPanelGroup}
            />
          ))}
        </div>
      )}
      {overlappedElementsInfo && setActiveOverlapInfoPanelGroup &&
        <OverlappedElementsInformationPanel
          group={activeOverlapInfoPanelGroup}
          onClose={() => setActiveOverlapInfoPanelGroup(undefined)}
          overlappedElementsInfo={overlappedElementsInfo}
          groups={groups}
        />}
      {selectedGroupForDeletion && (
        <DeleteModal
          entityName={selectedGroupForDeletion.groupName}
          onClose={onCloseDeleteModal}
          onDelete={async () => {
            await onDeleteGroup(selectedGroupForDeletion);
          }}
          refresh={onRefresh}
        />
      )}
    </InformationPanelWrapper>
  );
};
