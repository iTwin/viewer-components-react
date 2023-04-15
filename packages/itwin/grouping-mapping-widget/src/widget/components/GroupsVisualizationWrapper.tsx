/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { useActiveIModelConnection } from "@itwin/appui-react";
import type { Group } from "@itwin/insights-client";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useGroupHilitedElementsContext } from "./context/GroupHilitedElementsContext";
import {
  getHiliteIdsFromGroups,
  hideGroup,
  hideGroups,
  visualizeGroupColors,
} from "./groupsHelpers";
import {
  clearEmphasizedElements,
  clearEmphasizedOverriddenElements,
  clearHiddenElements,
  hideElements,
  zoomToElements,
} from "./viewerUtils";
import type { ActionButtonRenderer, ActionButtonRendererProps, GroupingProps } from "./Grouping";
import { Groupings } from "./Grouping";
import { GroupColorLegend } from "./GroupColorLegend";
import { GroupVisualizationActions } from "./GroupsVisualizationActions";
import { GroupsShowHideButtons } from "./GroupsShowHideButtons";

export interface GroupsVisualizationWrapperProps extends GroupingProps {
  isNonEmphasizedSelectable?: boolean;
  emphasizeElements?: boolean;
}

export const GroupsVisualizationWrapper = ({
  emphasizeElements = true,
  isNonEmphasizedSelectable = false,
  onClickGroupModify,
  onClickAddGroup,
  ...rest
}: GroupsVisualizationWrapperProps) => {
  const iModelConnection = useActiveIModelConnection();
  if (!iModelConnection) {
    throw new Error("This component requires an active iModelConnection.");
  }
  const [isLoadingQuery, setLoadingQuery] = useState<boolean>(false);
  const {
    hilitedElementsQueryCache,
    groups,
    hiddenGroupsIds,
    showGroupColor,
    setHiddenGroupsIds,
  } = useGroupHilitedElementsContext();

  const getHiliteIdsFromGroupsWrapper = useCallback(
    async (groups: Group[]): Promise<string[]> =>
      iModelConnection
        ? getHiliteIdsFromGroups(
          iModelConnection,
          groups,
          hilitedElementsQueryCache
        )
        : [],
    [iModelConnection, hilitedElementsQueryCache]
  );

  const visualizeGroupColorsWrapper = useCallback(
    async () => {
      setLoadingQuery(true);
      const groupsCopy = [...groups];
      await visualizeGroupColors(
        iModelConnection,
        groupsCopy,
        hiddenGroupsIds,
        hilitedElementsQueryCache,
        emphasizeElements
      );
      isNonEmphasizedSelectable && clearEmphasizedElements();
      setLoadingQuery(false);
    },
    [
      iModelConnection,
      groups,
      hiddenGroupsIds,
      hilitedElementsQueryCache,
      emphasizeElements,
      isNonEmphasizedSelectable,
    ]
  );

  useEffect(() => {
    const visualize = async () => {
      if (groups.length > 0 && showGroupColor) {
        await visualizeGroupColorsWrapper();
      } else {
        clearEmphasizedOverriddenElements();
      }
    };
    void visualize();
  }, [groups, showGroupColor, visualizeGroupColorsWrapper]);

  const hideAllGroups = useCallback(
    async () => {
      setLoadingQuery(true);
      await hideGroups(iModelConnection, groups, hilitedElementsQueryCache);
      setLoadingQuery(false);
    },
    [groups, hilitedElementsQueryCache, iModelConnection]
  );

  const hideSingleGroupWrapper = useCallback(
    async (group: Group) => {
      setLoadingQuery(true);
      await hideGroup(iModelConnection, group, hilitedElementsQueryCache);
      setLoadingQuery(false);
    },
    [hilitedElementsQueryCache, iModelConnection]
  );

  const showGroup = useCallback(
    async (viewGroup: Group) => {
      clearHiddenElements();

      // hide group Ids filter
      const newHiddenGroups: Group[] = hiddenGroupsIds
        .map((id) => groups.find((g) => g.id === id))
        .filter((g): g is Group => !!g && g.id !== viewGroup.id);

      // view group Ids filter
      const viewIds = await getHiliteIdsFromGroupsWrapper(
        groups.filter((g) => !newHiddenGroups.find((hg) => hg.id === g.id))
      );
      let hiddenIds = await getHiliteIdsFromGroupsWrapper(newHiddenGroups);
      hiddenIds = hiddenIds.filter((id) => !viewIds.includes(id));
      hideElements(hiddenIds);
    },
    [groups, hiddenGroupsIds, getHiliteIdsFromGroupsWrapper]
  );

  const showAll = useCallback(async () => {
    setLoadingQuery(true);

    clearHiddenElements();
    setHiddenGroupsIds([]);
    const allIds = await getHiliteIdsFromGroupsWrapper(groups);
    await zoomToElements(allIds);

    setLoadingQuery(false);
  }, [getHiliteIdsFromGroupsWrapper, groups, setHiddenGroupsIds]);

  const hideAll = useCallback(async () => {
    await hideAllGroups();
    setHiddenGroupsIds(
      groups.map((g) => g.id).filter((id): id is string => !!id)
    );
    const allIds = await getHiliteIdsFromGroupsWrapper(groups);
    await zoomToElements(allIds);
  }, [
    setHiddenGroupsIds,
    groups,
    hideAllGroups,
    getHiliteIdsFromGroupsWrapper,
  ]);

  const onModify = useCallback(
    async (group: Group, type: string) => {
      if (!onClickGroupModify) return;
      if (group.id && hiddenGroupsIds.includes(group.id)) {
        await showGroup(group);
        setHiddenGroupsIds(hiddenGroupsIds.filter((id) => id !== group.id));
      }
      clearEmphasizedElements();
      onClickGroupModify(group, type);
    },
    [hiddenGroupsIds, onClickGroupModify, setHiddenGroupsIds, showGroup]
  );

  const onAddGroup = useCallback(
    (type: string) => {
      if (!onClickAddGroup) return;
      onClickAddGroup(type);
      clearEmphasizedElements();
    },
    [onClickAddGroup]
  );

  const groupActionButtonRenderers: ActionButtonRenderer[] = useMemo(() => [
    (props: ActionButtonRendererProps) =>
      showGroupColor ? <GroupColorLegend {...props} groups={groups} /> : [],
    (props: ActionButtonRendererProps) => (
      <GroupsShowHideButtons
        {...props}
        hiddenGroupsIds={hiddenGroupsIds}
        isLoadingQuery={isLoadingQuery}
        setHiddenGroupsIds={setHiddenGroupsIds}
        showGroup={showGroup}
        hideGroup={hideSingleGroupWrapper}
      />
    ),
  ].flat(), [groups, hiddenGroupsIds, hideSingleGroupWrapper, isLoadingQuery, setHiddenGroupsIds, showGroup, showGroupColor]);

  return (
    <>
      <GroupVisualizationActions
        isLoadingQuery={isLoadingQuery}
        showAll={showAll}
        hideAll={hideAll}
      />
      <Groupings
        onClickGroupModify={onModify}
        onClickAddGroup={onAddGroup}
        actionButtonRenderers={groupActionButtonRenderers}
        {...rest}
        disableActions={isLoadingQuery}
      />
    </>
  );
};
