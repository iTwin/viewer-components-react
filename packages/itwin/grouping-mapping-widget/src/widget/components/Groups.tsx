/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import React, { useCallback } from "react";
import type { Group, Mapping } from "@itwin/insights-client";
import type {
  ContextCustomUI,
} from "./customUI/GroupingMappingCustomUI";
import type { ActionButtonRenderer } from "./GroupsView";
import { GroupsView } from "./GroupsView";
import { useGroupsOperations } from "./hooks/useGroupsOperations";
import { Alert } from "@itwin/itwinui-react";

export interface GroupsProps {
  mapping: Mapping;
  actionButtonRenderers?: ActionButtonRenderer[];
  onClickAddGroup?: (queryGenerationType: string) => void;
  onClickGroupTitle?: (group: Group) => void;
  onClickGroupModify?: (group: Group, queryGenerationType: string) => void;
  onClickRenderContextCustomUI?: (
    contextCustomUI: Exclude<ContextCustomUI["uiComponent"], undefined>,
    group: Group,
    displayLabel: string,
  ) => void;
  disableActions?: boolean;
  isVisualizing?: boolean;
}

export const Groups = ({
  mapping,
  actionButtonRenderers,
  onClickAddGroup,
  onClickGroupTitle,
  onClickGroupModify,
  onClickRenderContextCustomUI,
  disableActions,
  isVisualizing,
}: GroupsProps) => {
  const {
    groups,
    isLoading,
    refresh,
    onDeleteGroup,
    setShowDeleteModal,
    showDeleteModal,
    groupUIs,
    contextUIs,
    numberOfVisualizedGroups,
    errorMessage,
    setErrorMessage,
  } = useGroupsOperations({ mappingId: mapping.id });

  const addGroup = useCallback((type: string) => {
    if (!onClickAddGroup) return;
    onClickAddGroup(type);
  }, [onClickAddGroup]);

  const renderAlert = useCallback(() => {
    if (!errorMessage) return;
    return (
      <Alert type="negative" onClose={() => setErrorMessage(undefined)}>
        {errorMessage}
      </Alert>
    );
  }, [errorMessage, setErrorMessage]);

  return (
    <GroupsView
      mapping={mapping}
      groups={groups}
      isLoading={isLoading}
      onRefresh={refresh}
      groupUIs={groupUIs}
      actionButtonRenderers={actionButtonRenderers}
      onClickAddGroup={addGroup}
      onClickGroupTitle={onClickGroupTitle}
      onClickGroupModify={onClickGroupModify}
      onClickRenderContextCustomUI={onClickRenderContextCustomUI}
      disableActions={disableActions}
      selectedGroupForDeletion={showDeleteModal}
      setSelectedGroupForDeletion={setShowDeleteModal}
      onDeleteGroup={onDeleteGroup}
      onCloseDeleteModal={() => setShowDeleteModal(undefined)}
      contextUIs={contextUIs}
      numberOfVisualizedGroups={isVisualizing ? numberOfVisualizedGroups : undefined}
      alert={renderAlert()}
    />
  );
};
