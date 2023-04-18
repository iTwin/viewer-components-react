/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { FeatureOverrideType } from "@itwin/core-common";
import type { IModelConnection } from "@itwin/core-frontend";
import type { Group } from "@itwin/insights-client";
import { toaster } from "@itwin/itwinui-react";
import { KeySet } from "@itwin/presentation-common";
import type { QueryCacheItem } from "./context/GroupHilitedElementsContext";
import { clearEmphasizedOverriddenElements, emphasizeElements, getHiliteIds, hideElements, overrideElements, zoomToElements } from "./viewerUtils";

const goldenAngle = 180 * (3 - Math.sqrt(5));

export const getGroupColor = function (index: number) {
  return `hsl(${index * goldenAngle + 60}, 100%, 50%)`;
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
  iModelConnection: IModelConnection,
  group: Group,
  hiddenGroupsIds: string[],
  hilitedElementsQueryCache: React.MutableRefObject<Map<string, QueryCacheItem>>,
  doEmphasizeElements: boolean,
  groupColor: string
) => {
  const result = await getHiliteIdsAndKeysetFromGroup(iModelConnection, group, hilitedElementsQueryCache);
  const hilitedIds = result.ids;
  overrideElements(hilitedIds, groupColor, FeatureOverrideType.ColorAndAlpha);

  doEmphasizeElements && emphasizeElements(hilitedIds, undefined);

  return hiddenGroupsIds.includes(group.id) ? [] : hilitedIds;
};

export const visualizeGroupColors = async (
  iModelConnection: IModelConnection,
  groups: Group[],
  hiddenGroupsIds: string[],
  hilitedElementsQueryCache: React.MutableRefObject<Map<string, QueryCacheItem>>,
  doEmphasizeElements: boolean = true
) => {
  clearEmphasizedOverriddenElements();

  const allIdsPromises = groups.map(async (group, index) =>
    processGroupVisualization(
      iModelConnection,
      group,
      hiddenGroupsIds,
      hilitedElementsQueryCache,
      doEmphasizeElements,
      getGroupColor(index)
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
