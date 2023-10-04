/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { FeatureOverrideType } from "@itwin/core-common";
import type { IModelConnection } from "@itwin/core-frontend";
import type { Group } from "@itwin/insights-client";
import { toaster } from "@itwin/itwinui-react";
import { KeySet } from "@itwin/presentation-common";
import type { OverlappedElementGroupPairs, OverlappedInfo, QueryCacheItem } from "./context/GroupHilitedElementsContext";
import { clearEmphasizedOverriddenElements, emphasizeElements, getHiliteIds, hideElements, overrideElements, zoomToElements } from "./viewerUtils";

const goldenAngle = 180 * (3 - Math.sqrt(5));

export const getGroupColor = function (index: number) {
  let hue = (index * goldenAngle + 60) % 360;
  // Remove red from the color wheel.
  if (hue >= 335) {
    hue = (hue + goldenAngle) % 360;
  } else if (hue <= 25) {
    hue = (hue - goldenAngle) % 360;
    if (hue < 0) hue += 360;  // Make sure hue is still within [0, 359] range
  }
  return `hsl(${hue}, 100%, 50%)`;
};

export const getHiliteIdsFromGroups = async (
  iModelConnection: IModelConnection,
  groups: Group[],
  hilitedElementsQueryCache: React.MutableRefObject<Map<string, QueryCacheItem>>
) => {
  const distinctQueries = new Set<string>();
  const promises: Promise<{ ids: string[] }>[] = [];
  for (const group of groups) {
    if (!distinctQueries.has(group.query)) {
      distinctQueries.add(group.query);
      promises.push(getHiliteIdsAndKeysetFromGroup(iModelConnection, group, hilitedElementsQueryCache));
    }
  }
  const results = await Promise.all(promises);
  const allIds = results.flatMap((result) => result.ids);
  return allIds;
};

export const hideGroups = async (
  iModelConnection: IModelConnection,
  viewGroups: Group[],
  hilitedElementsQueryCache: React.MutableRefObject<Map<string, QueryCacheItem>>
) => {
  const distinctQueries = new Set<string>();
  const promises: Promise<void>[] = [];

  for (const viewGroup of viewGroups) {
    if (!distinctQueries.has(viewGroup.query)) {
      distinctQueries.add(viewGroup.query);
      promises.push(hideGroup(iModelConnection, viewGroup, hilitedElementsQueryCache));
    }
  }
  await Promise.all(promises);
};

export const hideGroup = async (
  iModelConnection: IModelConnection,
  viewGroup: Group,
  hilitedElementsQueryCache: React.MutableRefObject<Map<string, QueryCacheItem>>
) => {
  const result = await getHiliteIdsAndKeysetFromGroup(iModelConnection, viewGroup, hilitedElementsQueryCache);
  hideElements(result.ids);
};

const processGroupVisualization = async (
  elements: Set<string>,
  elementGroups: Set<string>,
  hiddenGroupsIds: Set<string>,
  doEmphasizeElements: boolean,
  index: number,
  setNumberOfVisualizedGroups: (numberOfVisualizedGroups: number | ((numberOfVisualizedGroups: number) => number)) => void,
) => {
  const hilitedIds = Array.from(elements);
  const redHsl = "hsl(0, 100%, 50%)";
  overrideElements(hilitedIds, elementGroups.size === 1 ? getGroupColor(index) : redHsl, FeatureOverrideType.ColorAndAlpha);
  setNumberOfVisualizedGroups((numberOfVisualizedGroups) => numberOfVisualizedGroups + 1);

  doEmphasizeElements && emphasizeElements(hilitedIds, undefined);

  for (const id of elementGroups) {
    if (hiddenGroupsIds.has(id)) {
      return [];
    }
  }
  return hilitedIds;
};

export const visualizeGroupColors = async (
  iModelConnection: IModelConnection,
  groups: Group[],
  hiddenGroupsIds: Set<string>,
  hilitedElementsQueryCache: React.MutableRefObject<Map<string, QueryCacheItem>>,
  setNumberOfVisualizedGroups: (numberOfVisualizedGroups: number | ((numberOfVisualizedGroups: number) => number)) => void,
  setOverlappedElementsInfo: (overlappedElementsInfo: Map<string, OverlappedInfo[]> | ((overlappedElementsInfo: Map<string, OverlappedInfo[]>) => Map<string, OverlappedInfo[]>)) => void,
  setGroupElementsInfo: (groupElementsInfo: Map<string, number> | ((groupElementsInfo: Map<string, number>) => Map<string, number>)) => void,
  setOverlappedElementGroupPairs: (overlappedElementGroupPairs: OverlappedElementGroupPairs[]) => void,
  doEmphasizeElements: boolean = true,
) => {
  clearEmphasizedOverriddenElements();

  const { groupsWithGroupedOverlaps, overlappedElementsInfo, numberOfElementsInGroups } = await getGroups(groups, iModelConnection, hilitedElementsQueryCache);
  setOverlappedElementsInfo(overlappedElementsInfo);
  setGroupElementsInfo(numberOfElementsInGroups);
  setOverlappedElementGroupPairs(groupsWithGroupedOverlaps);

  const allIdsPromises = groupsWithGroupedOverlaps.map(async (group, index) =>
    processGroupVisualization(
      group.elementIds,
      group.groups,
      hiddenGroupsIds,
      doEmphasizeElements,
      index,
      setNumberOfVisualizedGroups,
    )
  );

  const allIdsArrays = await Promise.all(allIdsPromises);
  const allIds = allIdsArrays.flat();

  await zoomToElements(allIds);
};

export const getHiliteIdsAndKeysetFromGroup = async (
  iModelConnection: IModelConnection,
  group: Group,
  hilitedElementsQueryCache: React.MutableRefObject<Map<string, QueryCacheItem>>
) => {
  const query = group.query;
  if (hilitedElementsQueryCache.current.has(query)) {
    return hilitedElementsQueryCache.current.get(query) ?? ({ keySet: new KeySet(), ids: [] });
  }
  try {
    const queryRowCount = await iModelConnection.queryRowCount(query);
    if (queryRowCount === 0) {
      toaster.warning(
        `${group.groupName}'s query is valid but produced no results.`
      );
    }
    const result = await getHiliteIds(query, iModelConnection);
    hilitedElementsQueryCache.current.set(query, result);
    return result;
  } catch {
    toaster.negative(
      `Query could not be resolved.`
    );
    return ({ keySet: new KeySet(), ids: [] });
  }

};

const processGroupIds = async (
  iModelConnection: IModelConnection,
  group: Group,
  hilitedElementsQueryCache: React.MutableRefObject<Map<string, QueryCacheItem>>,
) => {
  const result = await getHiliteIdsAndKeysetFromGroup(iModelConnection, group, hilitedElementsQueryCache);
  const hilitedIds = result.ids;
  return hilitedIds;
};

const getOverlappedElementsInfo = (overlappedElements: OverlappedElementGroupPairs[]) => {
  const overlappedElementsInfo: Map<string, OverlappedInfo[]> = new Map();

  overlappedElements.forEach((elementGroup) => {
    const { elementIds, groups } = elementGroup;

    groups.forEach((group) => {
      const otherGroups = Array.from(groups).filter((grp) => grp !== group);
      const overlappedInfoArray = overlappedElementsInfo.get(group) ?? [];
      overlappedInfoArray.push({ groupIds: otherGroups, elements: Array.from(elementIds) });
      overlappedElementsInfo.set(group, overlappedInfoArray);
    });
  });
  return overlappedElementsInfo;
};

const mergeElementsByGroup = (elems: Map<string, Set<string>>) => {
  const mergedList: Map<string, OverlappedElementGroupPairs> = new Map();
  elems.forEach((groups, elementId) => {
    const sortedGroups = Array.from(groups).sort();
    const key = sortedGroups.join("-");
    const overlap = mergedList.get(key);
    if (overlap) {
      overlap.elementIds.add(elementId);
    } else {
      mergedList.set(key, { elementIds: new Set([elementId]), groups });
    }
  });
  return mergedList;
};

const getGroups = async (
  groups: Group[],
  iModelConnection: IModelConnection,
  hilitedElementsQueryCache: React.MutableRefObject<Map<string, QueryCacheItem>>,
) => {
  const groupsElementIds: { groupId: string, elementIds: string[] }[] = await Promise.all(groups.map(async (group) => ({
    groupId: group.id,
    elementIds: await processGroupIds(iModelConnection, group, hilitedElementsQueryCache),
  })));

  const allGroups: OverlappedElementGroupPairs[] = [];
  const elems: Map<string, Set<string>> = new Map();
  const groupElementCount: Map<string, number> = new Map();

  for (const groupInfo of groupsElementIds) {
    for (const elem of groupInfo.elementIds) {
      const elemGroups = elems.get(elem);
      if (elemGroups) {
        elemGroups.add(groupInfo.groupId);
      } else {
        elems.set(elem, new Set([groupInfo.groupId]));
      }
    }
    allGroups.push({ elementIds: new Set(groupInfo.elementIds), groups: new Set([groupInfo.groupId]) });
    groupElementCount.set(groupInfo.groupId, groupInfo.elementIds.length);
  }

  const mergedList = mergeElementsByGroup(elems);
  const overlappedGroupsInformation: OverlappedElementGroupPairs[] = Array.from(mergedList.values()).filter((value) => value.groups.size > 1);
  return { groupsWithGroupedOverlaps: [...allGroups, ...overlappedGroupsInformation], overlappedElementsInfo: getOverlappedElementsInfo(overlappedGroupsInformation), numberOfElementsInGroups: groupElementCount };
};

