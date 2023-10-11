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
import { clearEmphasizedOverriddenElements, clearHiddenElements, emphasizeElements, getHiliteIds, hideElements, overrideElements, zoomToElements } from "./viewerUtils";

const GOLDEN_ANGLE_MULTIPLIER = 1.5;  // Multiplier to spread colors more uniformly.
const BASE_HUE_OFFSET = 60;           // Initial hue offset to avoid certain colors e.g 0 offset would begin with red.
const HUE_ADJUSTMENT_STEP = 15;       // Step to adjust the hue to avoid the red spectrum.
const RED_HUE_LOWER_BOUND = 330;      // Lower bound of the red hue spectrum to avoid.
const RED_HUE_UPPER_BOUND = 30;       // Upper bound of the red hue spectrum to avoid.
const GOLDENANGLE = 180 * (3 - Math.sqrt(5));

const generateHSL = (hue: number, saturation: number = 100, lightness: number = 50) => {
  return `hsl(${hue}, ${saturation}%, ${lightness}%)`;
};

export const getGroupColor = (index: number) => {
  let hue = (index * GOLDENANGLE * GOLDEN_ANGLE_MULTIPLIER + BASE_HUE_OFFSET) % 360;

  while (hue >= RED_HUE_LOWER_BOUND || hue <= RED_HUE_UPPER_BOUND) {
    hue = (hue + HUE_ADJUSTMENT_STEP) % 360;
  }

  return generateHSL(hue);
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
  overlappedElementGroupPairs: OverlappedElementGroupPairs,
  hiddenGroupsIds: Set<string>,
  doEmphasizeElements: boolean,
  color: string,
  replace: boolean,
  setNumberOfVisualizedGroups: (numberOfVisualizedGroups: number | ((numberOfVisualizedGroups: number) => number)) => void,
) => {
  const hilitedIds = Array.from(overlappedElementGroupPairs.elementIds);

  overrideElements(hilitedIds, color, FeatureOverrideType.ColorAndAlpha, replace);
  setNumberOfVisualizedGroups((numberOfVisualizedGroups) => numberOfVisualizedGroups + 1);

  doEmphasizeElements && emphasizeElements(hilitedIds, undefined);

  for (const id of overlappedElementGroupPairs.groupIds) {
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

  const { groupsWithGroupedOverlaps, overlappedElementsInfo, numberOfElementsInGroups } = await generateOverlappedGroups(groups, iModelConnection, hilitedElementsQueryCache);
  setOverlappedElementsInfo(overlappedElementsInfo);
  setGroupElementsInfo(numberOfElementsInGroups);
  setOverlappedElementGroupPairs(groupsWithGroupedOverlaps);

  const singleGroupPromises = groupsWithGroupedOverlaps
    .filter((group) => group.groupIds.size === 1)
    .map(async (group, index) =>
      processGroupVisualization(
        group,
        hiddenGroupsIds,
        doEmphasizeElements,
        getGroupColor(index),  // color for single group
        false, // Shouldn't matter as replacement only accounts for same colored overrides.
        setNumberOfVisualizedGroups,
      )
    );

  const overlappedGroupPromises = groupsWithGroupedOverlaps
    .filter((group) => group.groupIds.size !== 1)
    .map(async (group) =>
      processGroupVisualization(
        group,
        hiddenGroupsIds,
        doEmphasizeElements,
        generateHSL(0),  // color for group of overlapped elements
        false,
        setNumberOfVisualizedGroups,
      )
    );

  clearHiddenElements();

  hiddenGroupsIds.forEach(async (groupId) => {
    await hideGroupConsideringOverlaps(groupsWithGroupedOverlaps, groupId, hiddenGroupsIds);
  });

  const allPromises = [...singleGroupPromises, ...overlappedGroupPromises];

  const allIds = (await Promise.all(allPromises)).flat();

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

const getHiliteIdsForGroup = async (
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
    const { elementIds, groupIds } = elementGroup;

    groupIds.forEach((group) => {
      const otherGroups = Array.from(groupIds).filter((grp) => grp !== group);
      const overlappedInfoArray = overlappedElementsInfo.get(group) ?? [];
      overlappedInfoArray.push({ groupIds: otherGroups, elements: Array.from(elementIds) });
      overlappedElementsInfo.set(group, overlappedInfoArray);
    });
  });
  return overlappedElementsInfo;
};

const mergeElementsByGroup = (elems: Map<string, Set<string>>) => {
  const mergedList: Map<string, OverlappedElementGroupPairs> = new Map();
  elems.forEach((groupIds, elementId) => {
    const sortedGroups = Array.from(groupIds).sort();
    const key = sortedGroups.join("-");
    const overlap = mergedList.get(key);
    if (overlap) {
      overlap.elementIds.add(elementId);
    } else {
      mergedList.set(key, { elementIds: new Set([elementId]), groupIds });
    }
  });
  return mergedList;
};

const generateOverlappedGroups = async (
  groups: Group[],
  iModelConnection: IModelConnection,
  hilitedElementsQueryCache: React.MutableRefObject<Map<string, QueryCacheItem>>,
) => {
  const groupsElementIds: { groupId: string, elementIds: string[] }[] = await Promise.all(groups.map(async (group) => ({
    groupId: group.id,
    elementIds: await getHiliteIdsForGroup(iModelConnection, group, hilitedElementsQueryCache),
  })));

  const elems: Map<string, Set<string>> = new Map();
  const groupElementCount: Map<string, number> = new Map();

  // Build the elems map for associations between elements and their groups.
  for (const groupInfo of groupsElementIds) {
    for (const elem of groupInfo.elementIds) {
      const elemGroups = elems.get(elem) || new Set<string>();
      elemGroups.add(groupInfo.groupId);
      elems.set(elem, elemGroups);
    }
    groupElementCount.set(groupInfo.groupId, groupInfo.elementIds.length);
  }

  // Construct the unique list of all groups and their overlapped groups combinations
  const allGroups: OverlappedElementGroupPairs[] = groupsElementIds.map((groupInfo) => {
    const nonOverlappingElements = Array.from(new Set(groupInfo.elementIds)).filter((elem) => elems.get(elem)!.size === 1);
    groupElementCount.set(groupInfo.groupId, groupInfo.elementIds.length);
    return { elementIds: new Set(nonOverlappingElements), groupIds: new Set([groupInfo.groupId]) };
  });

  const mergedList = mergeElementsByGroup(elems);
  const overlappedGroupsInformation: OverlappedElementGroupPairs[] = Array.from(mergedList.values()).filter((value) => value.groupIds.size > 1);

  return { groupsWithGroupedOverlaps: [...allGroups, ...overlappedGroupsInformation], overlappedElementsInfo: getOverlappedElementsInfo(overlappedGroupsInformation), numberOfElementsInGroups: groupElementCount };
};

export const hideGroupConsideringOverlaps = async (
  overlappedElementGroupPairs: OverlappedElementGroupPairs[],
  groupIdToHide: string,
  hiddenGroupsIds: Set<string>
) => {
  const elementsToPotentiallyHide = new Set<string>();

  // Check each entry in overlappedElementGroupPairs
  for (const entry of overlappedElementGroupPairs) {
    // If the groupToHide is part of this entry
    if (entry.groupIds.has(groupIdToHide)) {
      // If this is a unique entry (no overlaps for this group), add all its elements to hide list
      if (entry.groupIds.size === 1) {
        for (const elem of entry.elementIds) {
          elementsToPotentiallyHide.add(elem);
        }
      } else {
        // If there are overlaps, only hide if all overlapping groups are hidden
        const allOtherGroupsHidden = Array.from(entry.groupIds).every(
          (groupId) =>
            groupId === groupIdToHide || hiddenGroupsIds.has(groupId)
        );
        if (allOtherGroupsHidden) {
          for (const elem of entry.elementIds) {
            elementsToPotentiallyHide.add(elem);
          }
        }
      }
    }
  }

  // Now hide all elements in elementsToPotentiallyHide
  hideElements(Array.from(elementsToPotentiallyHide));
};
