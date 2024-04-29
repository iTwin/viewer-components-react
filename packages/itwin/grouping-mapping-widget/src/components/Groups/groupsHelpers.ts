/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { FeatureOverrideType } from "@itwin/core-common";
import type { IModelConnection } from "@itwin/core-frontend";
import type { Group, GroupMinimal } from "@itwin/insights-client";
import type { OverlappedElementGroupPairs, OverlappedInfo } from "../context/GroupHilitedElementsContext";
import { clearEmphasizedOverriddenElements, clearHiddenElements, emphasizeElements, getHiliteIds, hideElements, overrideElements } from "../../common/viewerUtils";

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

export type GroupsElementIds = {
  groupId: string;
  elementIds: string[];
}[];

export const hideGroupIds = (hiddenGroupIds: Set<string>, groupsWithGroupedOverlaps: OverlappedElementGroupPairs[]  ) => {
  hiddenGroupIds.forEach((groupId) => {
    hideGroupConsideringOverlaps(groupsWithGroupedOverlaps, groupId, hiddenGroupIds);
  });
};

export const visualizeGroupColors = async (
  hiddenGroupsIds: Set<string>,
  groupsWithGroupedOverlaps: OverlappedElementGroupPairs[],
  setNumberOfVisualizedGroups: (numberOfVisualizedGroups: number | ((numberOfVisualizedGroups: number) => number)) => void,
  doEmphasizeElements: boolean = true,
) => {
  clearEmphasizedOverriddenElements();

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

  const allPromises = [...singleGroupPromises, ...overlappedGroupPromises];

  const allIds = (await Promise.all(allPromises)).flat();
  return allIds;
};

export const getHiliteIdsAndKeysetFromGroup = async (
  iModelConnection: IModelConnection,
  group: Group | GroupMinimal,
) => {
  const query = group.query;
  const result = await getHiliteIds(query, iModelConnection);
  return {query, result};

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

export const generateOverlappedGroups = (
  groupsElementIds: GroupsElementIds,
) => {
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

export const hideGroupConsideringOverlaps = (
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
