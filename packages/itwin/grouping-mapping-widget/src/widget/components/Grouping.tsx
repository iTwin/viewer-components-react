/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import React, { useCallback, useEffect, useState } from "react";
import type { CreateTypeFromInterface } from "../utils";
import {
  ButtonGroup,
  IconButton,
  ProgressLinear,
  Alert,
  InformationPanelWrapper
} from "@itwin/itwinui-react";
import {
  SvgRefresh,
} from "@itwin/itwinui-icons-react";
import DeleteModal from "./DeleteModal";
import "./Grouping.scss";
import { EmptyMessage, handleError, LoadingOverlay } from "./utils";
import type { Group, IMappingsClient, Mapping } from "@itwin/insights-client";
import { useMappingClient } from "./context/MappingClientContext";
import type { GetAccessTokenFn } from "./context/GroupingApiConfigContext";
import { useGroupingMappingApiConfig } from "./context/GroupingApiConfigContext";
import { useGroupingMappingCustomUI } from "./context/GroupingMappingCustomUIContext";
import { GroupingMappingCustomUIType } from "./customUI/GroupingMappingCustomUI";
import type {
  ContextCustomUI,
  GroupingCustomUI,
} from "./customUI/GroupingMappingCustomUI";
import { useGroupHilitedElementsContext } from "./context/GroupHilitedElementsContext";
import { GroupsAddButton } from "./GroupsAddButton";
import { GroupItem } from "./GroupItem";
import { OverlappedElementsInformationPanel } from "./OverlappedElementsInformationPanel";

export type IGroupTyped = CreateTypeFromInterface<Group>;

export interface ActionButtonRendererProps {
  group: Group;
}

export type ActionButtonRenderer = (
  props: ActionButtonRendererProps
) => React.ReactNode;

export interface GroupingProps {
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

const fetchGroups = async (
  setGroups: (groups: Group[]) => void,
  iModelId: string,
  mappingId: string,
  setIsLoading: (isLoading: boolean) => void,
  getAccessToken: GetAccessTokenFn,
  mappingsClient: IMappingsClient
): Promise<void> => {
  try {
    setIsLoading(true);
    const accessToken = await getAccessToken();
    const groups = await mappingsClient.getGroups(
      accessToken,
      iModelId,
      mappingId
    );
    setGroups(groups.sort((a, b) => a.groupName.localeCompare(b.groupName)));
  } catch (error: any) {
    handleError(error.status);
  } finally {
    setIsLoading(false);
  }
};

export const Groupings = ({
  mapping,
  actionButtonRenderers,
  onClickAddGroup,
  onClickGroupTitle,
  onClickGroupModify,
  onClickRenderContextCustomUI,
  disableActions,
  isVisualizing,
}: GroupingProps) => {
  const { getAccessToken, iModelId } = useGroupingMappingApiConfig();
  const { groups, setGroups, numberOfVisualizedGroups, overlappedElementsInfo, showGroupColor, totalNumberOfVisualization } = useGroupHilitedElementsContext();
  const mappingClient = useMappingClient();
  const groupUIs: GroupingCustomUI[] =
    useGroupingMappingCustomUI().customUIs.filter(
      (p) => p.type === GroupingMappingCustomUIType.Grouping
    ) as GroupingCustomUI[];
  const contextUIs: ContextCustomUI[] =
    useGroupingMappingCustomUI().customUIs.filter(
      (p) => p.type === GroupingMappingCustomUIType.Context
    ) as ContextCustomUI[];
  const [showDeleteModal, setShowDeleteModal] = useState<Group | undefined>(
    undefined
  );
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isOverlappedElementsInfoPanelOpen, setIsOverlappedElementsInfoPanelOpen] = useState<Group | undefined>(undefined);
  const [isAlertClosed, setIsAlertClosed] = useState<boolean>(true);
  const [isAlertExpanded,setIsAlertExpanded] = useState<boolean>(false);

  useEffect(() => {
    const initialize = async () => {
      await fetchGroups(
        setGroups,
        iModelId,
        mapping.id,
        setIsLoading,
        getAccessToken,
        mappingClient
      );
    };
    void initialize();
  }, [getAccessToken, mappingClient, iModelId, mapping.id, setGroups]);

  const addGroup = useCallback((type: string) => {
    if (!onClickAddGroup) return;
    onClickAddGroup(type);
  }, [onClickAddGroup]);

  const refresh = useCallback(async () => {
    await fetchGroups(
      setGroups,
      iModelId,
      mapping.id,
      setIsLoading,
      getAccessToken,
      mappingClient
    );
  }, [getAccessToken, mappingClient, iModelId, mapping.id, setGroups]);

  return (
    <>
      <InformationPanelWrapper className="gmw-groups-container">
        <div className={ `gmw-toolbar ${ isVisualizing ? "gmw-visualizing-toolbar" : "" }` }>
          {onClickAddGroup && groupUIs.length > 0 && (
            <GroupsAddButton
              disabled={disableActions}
              groupUIs={groupUIs}
              onClickAddGroup={addGroup}
            />
          )}
          <ButtonGroup className="gmw-toolbar-buttons">
            <IconButton
              title="Refresh"
              onClick={refresh}
              disabled={isLoading || disableActions}
              styleType="borderless"
            >
              <SvgRefresh />
            </IconButton>
          </ButtonGroup>
        </div>

        {isVisualizing && (numberOfVisualizedGroups !== undefined) &&
        <div className = "gmw-group-progress-bar">
          <ProgressLinear
            value={ 25 + ( numberOfVisualizedGroups / totalNumberOfVisualization* 65 ) }
          />
        </div>}

        {isLoading ? (
          <LoadingOverlay />
        ) : groups.length === 0 ? (
          <EmptyMessage message="No Groups available." />
        ) : (
          <>
            {overlappedElementsInfo.size > 0 && isAlertClosed && showGroupColor && !isVisualizing &&
            <Alert
            onClose={() => setIsAlertClosed(false)}
            clickableText={isAlertExpanded ? 'Less Details' : 'More Details'}
            clickableTextProps={{ onClick: () => setIsAlertExpanded(!isAlertExpanded) }}
            > 
              {isAlertExpanded ? (
              <>
                Overlapped elements are colored in red in the viewer. <br />
                To get overlap info in details, click the "Overlap Info" in the menu icon adjacent to the groups. 
              </>
              ) : (
              <>
                Overlapped elements are colored in red in the viewer.
              </>
              )}            
            </Alert>}

            <div className="gmw-group-list">
              {groups.map((g) => (
                <GroupItem
                  key={g.id}
                  mapping={mapping}
                  group={g}
                  groupUIs={groupUIs}
                  contextUIs={contextUIs}
                  actionButtonRenderers={actionButtonRenderers}
                  onClickGroupTitle={onClickGroupTitle}
                  onClickGroupModify={onClickGroupModify}
                  onClickRenderContextCustomUI={onClickRenderContextCustomUI}
                  disableActions={disableActions}
                  setShowDeleteModal={setShowDeleteModal}
                  setIsOverlappedElementsInfoPanelOpen={setIsOverlappedElementsInfoPanelOpen}
                  isVisualizing={isVisualizing}
                />
              ))}
            </div>
          </>
        )}

        <OverlappedElementsInformationPanel
          group={isOverlappedElementsInfoPanelOpen}
          onClose={() => setIsOverlappedElementsInfoPanelOpen(undefined)}
          overlappedElementsInfo={overlappedElementsInfo}
          groups={groups}
        />
      </InformationPanelWrapper>
      <DeleteModal
        entityName={showDeleteModal?.groupName}
        onClose={() => setShowDeleteModal(undefined)}
        onDelete={async () => {
          const accessToken = await getAccessToken();
          await mappingClient.deleteGroup(
            accessToken,
            iModelId,
            mapping.id,
            showDeleteModal?.id ?? ""
          );
        }}
        refresh={refresh}
      />
    </>
  );
};
