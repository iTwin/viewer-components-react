/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import type { Group } from "@itwin/insights-client";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import type { OverlappedElementGroupPairs } from "../context/GroupHilitedElementsContext";
import { useGroupHilitedElementsContext } from "../context/GroupHilitedElementsContext";
import {
  generateOverlappedGroups,
  hideGroupConsideringOverlaps,
  visualizeGroupColors,
} from "./groupsHelpers";
import {
  clearEmphasizedElements,
  clearEmphasizedOverriddenElements,
  clearHiddenElements,
  hideElements,
  zoomToElements,
} from "../../common/viewerUtils";
import type { GroupsProps } from "./Groups";
import { Groups } from "./Groups";
import { GroupColorLegend } from "./GroupColorLegend";
import { GroupVisualizationActions } from "./GroupsVisualizationActions";
import { GroupsShowHideButtons } from "./GroupsShowHideButtons";
import "./GroupsVisualization.scss";
import { useGroupingMappingApiConfig } from "../context/GroupingApiConfigContext";
import type { ActionButtonRenderer, ActionButtonRendererProps } from "./GroupsView";
import { Alert, Icon, Text } from "@itwin/itwinui-react";
import { SvgMore } from "@itwin/itwinui-icons-react";
import { useMappingClient } from "../context/MappingClientContext";
import { useMutation } from "@tanstack/react-query";
import { useIsMounted } from "../../common/hooks/useIsMounted";
import { useFetchGroups } from "./hooks/useFetchGroups";
import { useKeySetHiliteQueries } from "./hooks/useKeySetHiliteQueries";

export interface GroupsVisualizationProps extends GroupsProps {
  isNonEmphasizedSelectable?: boolean;
  emphasizeElements?: boolean;
}

export const GroupsVisualization = ({
  emphasizeElements = true,
  isNonEmphasizedSelectable = false,
  onClickGroupModify,
  onClickAddGroup,
  mapping,
  ...rest
}: GroupsVisualizationProps) => {
  const { iModelConnection } = useGroupingMappingApiConfig();
  if (!iModelConnection) {
    throw new Error("This component requires an active iModelConnection.");
  }
  const [isAlertClosed, setIsAlertClosed] = useState<boolean>(true);
  const [isAlertExpanded, setIsAlertExpanded] = useState<boolean>(false);
  const {
    hiddenGroupsIds,
    showGroupColor,
    setShowGroupColor,
    isOverlappedColored,
    setHiddenGroupsIds,
    setNumberOfVisualizedGroups,
    isVisualizationsEnabled,
    setIsVisualizationsEnabled,
    overlappedElementsMetadata,
    setOverlappedElementsMetadata,
  } = useGroupHilitedElementsContext();
  const { getAccessToken, iModelId } = useGroupingMappingApiConfig();
  const mappingClient = useMappingClient();
  const { data: groups, isFetched: isGroupsFetched, isFetching: isGroupsFetching } = useFetchGroups(iModelId, mapping.id, getAccessToken, mappingClient);
  const isMounted = useIsMounted();
  const [enableGroupQueries, setEnableGroupQueries] = useState<boolean>(false);
  const { groupQueries } = useKeySetHiliteQueries(groups ?? [], enableGroupQueries, iModelConnection);

  const triggerVisualization = useCallback(async (groupsWithGroupedOverlaps: OverlappedElementGroupPairs[]) =>
    visualizeGroupColors(
      hiddenGroupsIds,
      groupsWithGroupedOverlaps,
      setNumberOfVisualizedGroups,
      emphasizeElements,
    ), [emphasizeElements, hiddenGroupsIds, setNumberOfVisualizedGroups]);

  const zoomToElementsMutation = useMutation({
    mutationFn: zoomToElements,
    onSuccess: () => {
      if (isMounted()) {
        isNonEmphasizedSelectable && clearEmphasizedElements();
      }
    },
  });

  const visualizationMutation = useMutation({
    mutationFn: triggerVisualization,
    onSuccess: (allIds) => {
      if (isMounted()) {
        zoomToElementsMutation.mutate(allIds);
      }
    },
  });

  const isGroupsQueriesReady = useMemo(() =>
    groupQueries.every((query) => query.isFetched && query.data) && groupQueries.length > 0, [groupQueries]
  );
  const groupQueriesProgressCount = useMemo(() => groupQueries.filter((query) => query.isFetched).length, [groupQueries]);
  const isResolvingGroupQueries = useMemo(() => groupQueries.some((query) => query.isFetching), [groupQueries]);

  const hiliteIds = useMemo(
    () =>
      isGroupsQueriesReady
        ? groupQueries.map((query) => ({
          groupId: query.data!.group.id,
          elementIds: query.data!.result.ids,
        }))
        : [],
    [groupQueries, isGroupsQueriesReady]
  );
  const getHiliteIdsFromGroupsWrapper = useCallback(
    (groups: Group[]) =>
      hiliteIds.filter((id) => groups.some((group) => group.id === id.groupId)).flatMap((id) => id.elementIds),
    [hiliteIds]
  );

  useEffect(() => {
    if (isOverlappedColored === false) {
      if (hiliteIds.length > 0 && showGroupColor && !isGroupsFetching) {
        const results = generateOverlappedGroups(hiliteIds);
        const { groupsWithGroupedOverlaps, overlappedElementsInfo, numberOfElementsInGroups } = results;
        setOverlappedElementsMetadata({ overlappedElementsInfo, groupElementsInfo: numberOfElementsInGroups, overlappedElementGroupPairs: groupsWithGroupedOverlaps });
        visualizationMutation.mutate(results.groupsWithGroupedOverlaps);
      } else {
        clearEmphasizedOverriddenElements();
      }
    }
    // We don't want to trigger full visualization when toggling individual groups.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showGroupColor, isOverlappedColored, hiliteIds]);

  useEffect(() => {
    if (isVisualizationsEnabled) {
      setEnableGroupQueries(true);
    } else {
      setShowGroupColor(false);
      clearHiddenElements();
      setHiddenGroupsIds(new Set());
    }
  }, [isVisualizationsEnabled, setHiddenGroupsIds, setIsVisualizationsEnabled, setShowGroupColor]);

  const hideAllGroups = useCallback(
    () => {
      if (!groups) return;
      hideElements(getHiliteIdsFromGroupsWrapper(groups));
    },
    [getHiliteIdsFromGroupsWrapper, groups]
  );

  const hideSingleGroupWrapper = useCallback(
    (groupToHide: Group) => {
      hideGroupConsideringOverlaps(overlappedElementsMetadata.overlappedElementGroupPairs, groupToHide.id, hiddenGroupsIds);
    },
    [hiddenGroupsIds, overlappedElementsMetadata.overlappedElementGroupPairs]
  );

  const showGroup = useCallback(
    (viewGroup: Group) => {
      if (!groups) return;
      clearHiddenElements();

      // hide group Ids filter
      const newHiddenGroups: Group[] = groups.filter((g) => hiddenGroupsIds.has(g.id) && g.id !== viewGroup.id);

      // view group Ids filter
      const viewGroups = groups.filter((g) => !hiddenGroupsIds.has(g.id) || g.id === viewGroup.id);
      const viewIds = getHiliteIdsFromGroupsWrapper(viewGroups);

      let hiddenIds = getHiliteIdsFromGroupsWrapper(newHiddenGroups);
      hiddenIds = hiddenIds.filter((id) => !viewIds.includes(id));
      hideElements(hiddenIds);
    },
    [groups, hiddenGroupsIds, getHiliteIdsFromGroupsWrapper]
  );

  const showAll = useCallback(() => {
    clearHiddenElements();
    setHiddenGroupsIds(new Set());
  }, [setHiddenGroupsIds]);

  const hideAll = useCallback(() => {
    if (!groups) return;
    hideAllGroups();
    setHiddenGroupsIds(
      new Set(groups.map((g) => g.id))
    );

  }, [
    setHiddenGroupsIds,
    groups,
    hideAllGroups,
  ]);

  const onModify = useCallback(
    (group: Group, type: string) => {
      if (!onClickGroupModify) return;
      if (group.id && hiddenGroupsIds.has(group.id)) {
        showGroup(group);
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

  const groupActionButtonRenderers: ActionButtonRenderer[] = useMemo(() => isVisualizationsEnabled ? [
    (props: ActionButtonRendererProps) =>
      showGroupColor ? <GroupColorLegend {...props} groups={groups ?? []} /> : [],
    (props: ActionButtonRendererProps) => (
      <GroupsShowHideButtons
        {...props}
        isLoadingQuery={!(isVisualizationsEnabled && isGroupsFetched && isGroupsQueriesReady)}
        showGroup={showGroup}
        hideGroup={hideSingleGroupWrapper}
      />
    ),
  ].flat() : [], [groups, hideSingleGroupWrapper, isGroupsFetched, isGroupsQueriesReady, isVisualizationsEnabled, showGroup, showGroupColor]);

  const overlappedAlert = useMemo(() =>
    overlappedElementsMetadata.overlappedElementsInfo.size > 0 && isAlertClosed && showGroupColor ?
      <Alert
        onClose={() => setIsAlertClosed(false)}
        clickableText={isAlertExpanded ? "Less Details" : "More Details"}
        clickableTextProps={{ onClick: () => setIsAlertExpanded(!isAlertExpanded) }}
      >
        Overlapping elements are colored <Text className="gmw-red-text">red</Text> in the viewer.
        {isAlertExpanded ? (
          <>
            <br />
            To get overlap info in detail, click the <Icon><SvgMore /></Icon> button then &ldquo;Overlap Info&rdquo;
          </>
        ) : undefined}
      </Alert> : undefined, [isAlertClosed, isAlertExpanded, overlappedElementsMetadata.overlappedElementsInfo.size, showGroupColor]
  );

  const progressConfig = useMemo(
    () =>
      isVisualizationsEnabled && isResolvingGroupQueries
        ? {
          hilitedGroupsProgress: {
            currentHilitedGroups: groupQueriesProgressCount,
            totalNumberOfGroups: groups?.length ?? 0,
          },
        }
        : undefined,
    [groupQueriesProgressCount, groups, isResolvingGroupQueries, isVisualizationsEnabled],
  );

  return (
    <div className="gmw-groups-vis-container">
      <GroupVisualizationActions
        disabled={!(isVisualizationsEnabled && isGroupsFetched && isGroupsQueriesReady)}
        isVisualizationEnabled={isVisualizationsEnabled}
        onClickVisualizationButton={() => setIsVisualizationsEnabled((b) => !b)}
        showAll={showAll}
        hideAll={hideAll}
      />
      <Groups
        onClickGroupModify={onModify}
        onClickAddGroup={onAddGroup}
        actionButtonRenderers={groupActionButtonRenderers}
        mapping={mapping}
        {...rest}
        progressConfig={progressConfig}
        alert={overlappedAlert}
      />
    </div>
  );
};
