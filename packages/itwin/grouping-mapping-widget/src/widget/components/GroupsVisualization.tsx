/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import type { Group } from "@itwin/insights-client";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
} from "./viewerUtils";
import type { GroupsProps } from "./Groups";
import { Groups } from "./Groups";
import { GroupColorLegend } from "./GroupColorLegend";
import { GroupVisualizationActions } from "./GroupsVisualizationActions";
import { GroupsShowHideButtons } from "./GroupsShowHideButtons";
import "./GroupsVisualization.scss";
import { useGroupingMappingApiConfig } from "./context/GroupingApiConfigContext";
import type { ActionButtonRenderer, ActionButtonRendererProps } from "./GroupsView";

export interface GroupsVisualizationProps extends GroupsProps {
  isNonEmphasizedSelectable?: boolean;
  emphasizeElements?: boolean;
}

export const GroupsVisualization = ({
  emphasizeElements = true,
  isNonEmphasizedSelectable = false,
  onClickGroupModify,
  onClickAddGroup,
  ...rest
}: GroupsVisualizationProps) => {
  const { iModelConnection } = useGroupingMappingApiConfig();
  if (!iModelConnection) {
    throw new Error("This component requires an active iModelConnection.");
  }
  const firstUpdate = useRef(true);
  const [isLoadingQuery, setLoadingQuery] = useState<boolean>(false);
  const [isVisualizing, setIsVisualizing] = useState<boolean>(false);
  const {
    hilitedElementsQueryCache,
    groups,
    hiddenGroupsIds,
    showGroupColor,
    setHiddenGroupsIds,
    setNumberOfVisualizedGroups,
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

  const handleVisualizationStates = useCallback((start = true) => {
    setIsVisualizing(start);
    setLoadingQuery(start);
    if (!start) {
      setNumberOfVisualizedGroups(0);
    }
  }, [setNumberOfVisualizedGroups]);

  const triggerVisualization = useCallback(async () => {
    handleVisualizationStates(true);
    const groupsCopy = [...groups];
    await visualizeGroupColors(
      iModelConnection,
      groupsCopy,
      hiddenGroupsIds,
      hilitedElementsQueryCache,
      setNumberOfVisualizedGroups,
      emphasizeElements,
    );
    isNonEmphasizedSelectable && clearEmphasizedElements();
    handleVisualizationStates(false);
  }, [handleVisualizationStates, groups, iModelConnection, hiddenGroupsIds, hilitedElementsQueryCache, setNumberOfVisualizedGroups, emphasizeElements, isNonEmphasizedSelectable]);

  useEffect(() => {
    const visualize = async () => {
      if (firstUpdate.current) {
        firstUpdate.current = false;
        return;
      }
      if (groups.length > 0 && showGroupColor) {
        await triggerVisualization();
      } else {
        clearEmphasizedOverriddenElements();
      }
    };
    void visualize();
    // We don't want to trigger full visualization when toggling individual groups.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groups, showGroupColor]);

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
      setLoadingQuery(true);
      clearHiddenElements();

      // hide group Ids filter
      const newHiddenGroups: Group[] = groups.filter((g) => hiddenGroupsIds.has(g.id) && g.id !== viewGroup.id);

      // view group Ids filter
      const viewGroups = groups.filter((g) => !hiddenGroupsIds.has(g.id) || g.id === viewGroup.id);
      const viewIds = await getHiliteIdsFromGroupsWrapper(viewGroups);

      let hiddenIds = await getHiliteIdsFromGroupsWrapper(newHiddenGroups);
      hiddenIds = hiddenIds.filter((id) => !viewIds.includes(id));
      hideElements(hiddenIds);
      setLoadingQuery(false);
    },
    [groups, hiddenGroupsIds, getHiliteIdsFromGroupsWrapper]
  );

  const showAll = useCallback(async () => {
    setLoadingQuery(true);

    clearHiddenElements();
    setHiddenGroupsIds(new Set());
    await getHiliteIdsFromGroupsWrapper(groups);

    setLoadingQuery(false);
  }, [getHiliteIdsFromGroupsWrapper, groups, setHiddenGroupsIds]);

  const hideAll = useCallback(async () => {
    await hideAllGroups();
    setHiddenGroupsIds(
      new Set(groups.map((g) => g.id))
    );
    await getHiliteIdsFromGroupsWrapper(groups);
  }, [
    setHiddenGroupsIds,
    groups,
    hideAllGroups,
    getHiliteIdsFromGroupsWrapper,
  ]);

  const onModify = useCallback(
    async (group: Group, type: string) => {
      if (!onClickGroupModify) return;
      if (group.id && hiddenGroupsIds.has(group.id)) {
        await showGroup(group);
        setHiddenGroupsIds(new Set([...hiddenGroupsIds].filter((id) => id !== group.id)));
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
        isLoadingQuery={isLoadingQuery}
        showGroup={showGroup}
        hideGroup={hideSingleGroupWrapper}
      />
    ),
  ].flat(), [groups, hideSingleGroupWrapper, isLoadingQuery, showGroup, showGroupColor]);

  return (
    <div className="gmw-groups-vis-container">
      <GroupVisualizationActions
        isLoadingQuery={isLoadingQuery}
        showAll={showAll}
        hideAll={hideAll}
      />
      <Groups
        onClickGroupModify={onModify}
        onClickAddGroup={onAddGroup}
        actionButtonRenderers={groupActionButtonRenderers}
        {...rest}
        disableActions={isLoadingQuery}
        isVisualizing={isVisualizing}
      />
    </div>
  );
};
