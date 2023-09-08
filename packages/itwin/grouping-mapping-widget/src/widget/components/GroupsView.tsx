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
  ProgressLinear,
} from "@itwin/itwinui-react";
import {
  SvgRefresh,
} from "@itwin/itwinui-icons-react";
import DeleteModal from "./DeleteModal";
import "./GroupingsView.scss";
import { EmptyMessage, LoadingOverlay } from "./utils";
import type { Group, Mapping } from "@itwin/insights-client";
import { GroupItem } from "./GroupItem";
import type { ContextCustomUI, GroupingCustomUI } from "./customUI/GroupingMappingCustomUI";
import { GroupsAddButton } from "./GroupsAddButton";

export interface ActionButtonRendererProps {
  group: Group;
}

export type ActionButtonRenderer = (
  props: ActionButtonRendererProps
) => React.ReactNode;

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
  numberOfVisualizedGroups?: number;
  alert?: React.ReactElement<typeof Alert>;
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
  numberOfVisualizedGroups,
  alert,
}: GroupsViewProps) => {
  return (
    <div className="gmw-groups-container">
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
      <div className='gmw-groupings-border' />
      {!!numberOfVisualizedGroups &&
        <div className="gmw-group-progress-bar">
          <ProgressLinear
            value={25 + (numberOfVisualizedGroups / groups.length * 65)}
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
            />
          ))}
        </div>
      )}
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
    </div>
  );
};
