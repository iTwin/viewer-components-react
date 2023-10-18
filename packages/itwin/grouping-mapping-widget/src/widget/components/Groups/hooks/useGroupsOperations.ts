/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { useCallback, useEffect, useState } from "react";
import type { Group, IMappingsClient } from "@itwin/insights-client";
import type { GetAccessTokenFn } from "../../context/GroupingApiConfigContext";
import { useGroupingMappingApiConfig } from "../../context/GroupingApiConfigContext";
import { getErrorMessage } from "../../SharedComponents/utils";
import type { ContextCustomUI, GroupingCustomUI } from "../../customUI/GroupingMappingCustomUI";
import { GroupingMappingCustomUIType } from "../../customUI/GroupingMappingCustomUI";
import { useGroupingMappingCustomUI } from "../../context/GroupingMappingCustomUIContext";
import { useGroupHilitedElementsContext } from "../../context/GroupHilitedElementsContext";
import { useMappingClient } from "../../context/MappingClientContext";

const fetchGroups = async (
  setGroups: (groups: Group[]) => void,
  iModelId: string,
  mappingId: string,
  setIsLoading: (isLoading: boolean) => void,
  getAccessToken: GetAccessTokenFn,
  mappingsClient: IMappingsClient,
  setErrorMessage: (message: string | undefined) => void
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
    setErrorMessage(getErrorMessage(error.status));
  } finally {
    setIsLoading(false);
  }
};

export interface GroupsOperationsProps {
  mappingId: string;
}

export const useGroupsOperations = ({
  mappingId,
}: GroupsOperationsProps) => {
  const { getAccessToken, iModelId } = useGroupingMappingApiConfig();
  const { groups, setGroups, currentHilitedGroups, overlappedElementsInfo, overlappedElementGroupPairs } = useGroupHilitedElementsContext();
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
  const [errorMessage, setErrorMessage] = useState<string | undefined>(undefined);
  const [activeOverlapInfoPanelGroup, setActiveOverlapInfoPanelGroup] = useState<Group | undefined>(undefined);

  useEffect(() => {
    const initialize = async () => {
      await fetchGroups(
        setGroups,
        iModelId,
        mappingId,
        setIsLoading,
        getAccessToken,
        mappingClient,
        setErrorMessage
      );
    };
    void initialize();
  }, [getAccessToken, mappingClient, iModelId, mappingId, setGroups]);

  const refresh = useCallback(async () => {
    await fetchGroups(
      setGroups,
      iModelId,
      mappingId,
      setIsLoading,
      getAccessToken,
      mappingClient,
      setErrorMessage
    );
  }, [getAccessToken, mappingClient, iModelId, mappingId, setGroups]);

  const onDeleteGroup = useCallback(async (group: Group) => {
    const accessToken = await getAccessToken();
    await mappingClient.deleteGroup(
      accessToken,
      iModelId,
      mappingId,
      group.id
    );
    await refresh();
  }, [getAccessToken, iModelId, mappingClient, mappingId, refresh]);

  return {
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
    hilitedGroupsProgress: { currentHilitedGroups, totalNumberOfGroups: overlappedElementGroupPairs.length },
  };
};
