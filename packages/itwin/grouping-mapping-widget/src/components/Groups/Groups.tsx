/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
import React, { useCallback } from "react";
import type { GroupMinimal, Mapping } from "@itwin/insights-client";
import type { ContextCustomUI } from "../customUI/GroupingMappingCustomUI";
import type { ActionButtonRenderer, ProgressConfig } from "./GroupsView";
import { GroupsView } from "./GroupsView";
import { useGroupsOperations } from "./hooks/useGroupsOperations";
import { Alert } from "@itwin/itwinui-react";

/**
 * Props for the {@link Groups} component.
 * @public
 */
export interface GroupsProps {
  mapping: Mapping;
  actionButtonRenderers?: ActionButtonRenderer[];
  onClickAddGroup?: (queryGenerationType: string) => void;
  onClickGroupTitle?: (group: GroupMinimal) => void;
  onClickGroupModify?: (group: GroupMinimal, queryGenerationType: string) => void;
  onClickRenderContextCustomUI?: (contextCustomUI: Exclude<ContextCustomUI["uiComponent"], undefined>, group: GroupMinimal, displayLabel: string) => void;
  disableActions?: boolean;
  isVisualizing?: boolean;
  progressConfig?: ProgressConfig;
  alert?: React.ReactElement<typeof Alert>;
  hideRefreshIcon?: boolean;
}

/**
 * Component to list groups and handle basic operations.
 * @public
 */
export const Groups = ({
  mapping,
  actionButtonRenderers,
  onClickAddGroup,
  onClickGroupTitle,
  onClickGroupModify,
  onClickRenderContextCustomUI,
  disableActions,
  progressConfig,
  alert,
  hideRefreshIcon
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
    errorMessage,
    setErrorMessage,
    activeOverlapInfoPanelGroup,
    setActiveOverlapInfoPanelGroup,
    overlappedElementsInfo,
  } = useGroupsOperations({ mappingId: mapping.id });

  const addGroup = useCallback(
    (type: string) => {
      if (!onClickAddGroup) return;
      onClickAddGroup(type);
    },
    [onClickAddGroup],
  );

  const renderAlert = useCallback(() => {
    if (!errorMessage) {
      return alert;
    }
    return (
      <Alert type="negative" onClose={() => setErrorMessage(undefined)}>
        {errorMessage}
      </Alert>
    );
  }, [alert, errorMessage, setErrorMessage]);

  return (
    <GroupsView
      mapping={mapping}
      groups={groups ?? []}
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
      progressConfig={progressConfig}
      alert={renderAlert()}
      setActiveOverlapInfoPanelGroup={setActiveOverlapInfoPanelGroup}
      activeOverlapInfoPanelGroup={activeOverlapInfoPanelGroup}
      overlappedElementsInfo={overlappedElementsInfo}
      hideRefreshIcon={hideRefreshIcon}
    />
  );
};
