/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { FeatureOverrideType } from "@itwin/core-common";
import type { IModelConnection } from "@itwin/core-frontend";
import type { Group } from "@itwin/insights-client";
import { toaster } from "@itwin/itwinui-react";
import { KeySet } from "@itwin/presentation-common";
import type { QueryCacheItem, OverlappedInfo } from "./context/GroupHilitedElementsContext";
import { clearEmphasizedOverriddenElements, emphasizeElements, getHiliteIds, hideElements, overrideElements, zoomToElements } from "./viewerUtils";

const goldenAngle = 180 * (3 - Math.sqrt(5));

export const getGroupColor = function (index: number) {
  var hue = (index * goldenAngle + 60) % 360;
  while (hue >= 335 || hue <= 25) {
    hue = (hue + (index * goldenAngle)) % 360;
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
  overrideElements(hilitedIds, elementGroups.size === 1 ? getGroupColor(index) : "hsl(0, 100%, 50%)", FeatureOverrideType.ColorAndAlpha);
  setNumberOfVisualizedGroups((numberOfVisualizedGroups) => numberOfVisualizedGroups + 1);

  doEmphasizeElements && emphasizeElements(hilitedIds, undefined);

  for (var id in elementGroups) {
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
  setTotalNumberOfVisualization: (totalNumberOfVisualization: number) => void,
  doEmphasizeElements: boolean = true,
) => {
  clearEmphasizedOverriddenElements();

  var { updatedGroups, overlappedElementsInfo, numberOfElementsInGroups } = await getGroups(groups, iModelConnection, hiddenGroupsIds, hilitedElementsQueryCache);
  setOverlappedElementsInfo(overlappedElementsInfo);
  setGroupElementsInfo(numberOfElementsInGroups);
  setTotalNumberOfVisualization(updatedGroups.length);

  const allIdsPromises = updatedGroups.map(async (group, index) =>
    processGroupVisualization(
      group.element,
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

interface OverlappedElements {
  element: Set<string>;
  groups: Set<string>
};

const processGroupIds = async (
  iModelConnection: IModelConnection,
  group: Group,
  hiddenGroupsIds: Set<string>,
  hilitedElementsQueryCache: React.MutableRefObject<Map<string, QueryCacheItem>>,
) => {
  const result = await getHiliteIdsAndKeysetFromGroup(iModelConnection, group, hilitedElementsQueryCache);
  const hilitedIds = result.ids;
  return hiddenGroupsIds.has(group.id) ? [] : hilitedIds;
};

const getOverlappedElementsInfo = (overlappedElements: OverlappedElements[]) => {
  const overlappedElementsInfo: Map<string, OverlappedInfo[]> = new Map();

  overlappedElements.forEach((elementGroup) => {
    const { element, groups } = elementGroup;

    groups.forEach((group) => {
      const otherGroups = Array.from(groups).filter((grp) => grp !== group);
      const overlappedInfoArray = overlappedElementsInfo.get(group) ?? [];
      overlappedInfoArray.push({ groupIds: otherGroups, elements: Array.from(element) });
      overlappedElementsInfo.set(group, overlappedInfoArray);
    });
  });
  return overlappedElementsInfo;
}

const mergeElementsByGroup = (elems: Map<string, Set<string>>) => {
  const mergedList:  Map<string, OverlappedElements> = new Map();
  elems.forEach((groups,elementId) =>{
    const sortedGroups = Array.from(groups).sort();
    const key = sortedGroups.join('-');
    var overlap = mergedList.get(key);
    if (overlap) {
      overlap.element.add(elementId);
    }
    else {
      mergedList.set(key, { element: new Set([elementId]), groups: groups });
    }
  });
  return mergedList;
};

const getGroups = async (
  groups: Group[],
  iModelConnection: IModelConnection,
  hiddenGroupsIds: Set<string>,
  hilitedElementsQueryCache: React.MutableRefObject<Map<string, QueryCacheItem>>,
) => {
  var groupsInformation: {groupName: string, elements: string[]}[] = await Promise.all(groups.map(async (group) => ({
    groupName: group.id,
    elements: await processGroupIds(iModelConnection, group, hiddenGroupsIds, hilitedElementsQueryCache)
  })));

  const allGroups: OverlappedElements[] = [];
  const elems: Map<string,Set<string>> = new Map();
  const groupElementsMapping: Map<string,number> = new Map();

  for (let i = 0; i < groupsInformation.length; i++) {
    for (let j = 0; j < groupsInformation[i].elements.length; j++) {
      var elem = groupsInformation[i].elements[j];
      var elemGroups = elems.get(elem);
      if (elemGroups) {
        elemGroups.add(groupsInformation[i].groupName);
      }
      else {
        elems.set(elem,  new Set([groupsInformation[i].groupName])) ;
      }
    }
    allGroups[i] = { element: new Set(groupsInformation[i].elements), groups: new Set([groupsInformation[i].groupName]) };
    groupElementsMapping.set(groupsInformation[i].groupName,groupsInformation[i].elements.length);
  }

  var mergedList = mergeElementsByGroup(elems);
  const overlappedGroupsInformation: OverlappedElements[] = Array.from(mergedList.values()).filter(value => value.groups.size > 1);
  return { updatedGroups: [...allGroups, ...overlappedGroupsInformation], overlappedElementsInfo: getOverlappedElementsInfo(overlappedGroupsInformation), numberOfElementsInGroups: groupElementsMapping }
};

