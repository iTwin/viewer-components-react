/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { useCallback, useState } from "react";
import type { Group } from "@itwin/insights-client";
import { useGroupingMappingApiConfig } from "../../context/GroupingApiConfigContext";
import type { ContextCustomUI, GroupingCustomUI } from "../../customUI/GroupingMappingCustomUI";
import { GroupingMappingCustomUIType } from "../../customUI/GroupingMappingCustomUI";
import { useGroupingMappingCustomUI } from "../../context/GroupingMappingCustomUIContext";
import { useGroupHilitedElementsContext } from "../../context/GroupHilitedElementsContext";
import { useMappingClient } from "../../context/MappingClientContext";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useFetchGroups } from "./useFetchGroups";

export interface GroupsOperationsProps {
  mappingId: string;
}

export const useGroupsOperations = ({
  mappingId,
}: GroupsOperationsProps) => {
  const { getAccessToken, iModelId } = useGroupingMappingApiConfig();
  const { overlappedElementsMetadata: {  overlappedElementsInfo } } = useGroupHilitedElementsContext();

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
  const [errorMessage, setErrorMessage] = useState<string | undefined>(undefined);
  const [activeOverlapInfoPanelGroup, setActiveOverlapInfoPanelGroup] = useState<Group | undefined>(undefined);
  const queryClient = useQueryClient();

  const { data: groups, isLoading } = useFetchGroups(iModelId, mappingId, getAccessToken, mappingClient);

  const refresh = useCallback(async () => {
    await queryClient.invalidateQueries({queryKey: ["groups", mappingId]});
  }, [mappingId, queryClient]);

  const deleteGroupMutation = useMutation(
    {
      mutationFn: async (group: Group) => {
        const accessToken = await getAccessToken();
        await mappingClient.deleteGroup(accessToken, iModelId, mappingId, group.id);
      },
      onSuccess: refresh,
    }
  );

  const onDeleteGroup = async (group: Group) => {
    deleteGroupMutation.mutate(group);
  };

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
  };
};
