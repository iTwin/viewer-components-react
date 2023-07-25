/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import React, { useCallback, useEffect, useState } from "react";
import type { CreateTypeFromInterface } from "../utils";
import {
  ButtonGroup,
  IconButton,
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
}: GroupingProps) => {
  const { getAccessToken, iModelId } = useGroupingMappingApiConfig();
  const { groups, setGroups } = useGroupHilitedElementsContext();
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
      <div className="gmw-groups-container">
        <div className="gmw-toolbar">
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
        {isLoading ? (
          <LoadingOverlay />
        ) : groups.length === 0 ? (
          <EmptyMessage message="No Groups available." />
        ) : (
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
              />
            ))}
          </div>
        )}
      </div>
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
