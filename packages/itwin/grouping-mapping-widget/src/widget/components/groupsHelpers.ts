/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { FeatureOverrideType } from "@itwin/core-common";
import type { IModelConnection } from "@itwin/core-frontend";
import type { Group } from "@itwin/insights-client";
import { toaster } from "@itwin/itwinui-react";
import { KeySet } from "@itwin/presentation-common";
import { clearEmphasizedOverriddenElements, emphasizeElements, getHiliteIds, hideElements, overrideElements, zoomToElements } from "./viewerUtils";

const goldenAngle = 180 * (3 - Math.sqrt(5));

export const getGroupColor = function (index: number) {
  return `hsl(${index * goldenAngle + 60}, 100%, 50%)`;
};

export const getHiliteIdsFromGroups = async (
  iModelConnection: IModelConnection,
  groups: Group[],
  hilitedElementsQueryCache: React.MutableRefObject<Map<string, { keySet: KeySet, ids: string[] }>>
) => {
  let allIds: string[] = [];
  for (const group of groups) {
    const result = await getHiliteIdsAndKeysetFromGroup(iModelConnection, group, hilitedElementsQueryCache);
    const hilitedIds = result.ids;
    allIds = allIds.concat(hilitedIds);
  }
  return allIds;
};

export const hideGroups = async (
  iModelConnection: IModelConnection,
  viewGroups: Group[],
  hilitedElementsQueryCache: React.MutableRefObject<Map<string, { keySet: KeySet, ids: string[] }>>
) => {
  for (const viewGroup of viewGroups) {
    const result = await getHiliteIdsAndKeysetFromGroup(iModelConnection, viewGroup, hilitedElementsQueryCache);
    const hilitedIds = result.ids;
    hideElements(hilitedIds);
  }
};

export const visualizeGroupColors = async (
  iModelConnection: IModelConnection,
  groups: Group[],
  viewGroups: Group[],
  hiddenGroupsIds: string[],
  hilitedElementsQueryCache: React.MutableRefObject<Map<string, { keySet: KeySet, ids: string[] }>>,
  doEmphasizeElements: boolean = true
) => {
  clearEmphasizedOverriddenElements();
  let allIds: string[] = [];
  for (const group of viewGroups) {
    const index =
      viewGroups.length > groups.length
        ? viewGroups.findIndex((g) => g.id === group.id)
        : groups.findIndex((g) => g.id === group.id);
    const result = await getHiliteIdsAndKeysetFromGroup(iModelConnection, group, hilitedElementsQueryCache);
    const hilitedIds = result.ids;
    overrideElements(
      hilitedIds,
      getGroupColor(index),
      FeatureOverrideType.ColorAndAlpha,
    );
    doEmphasizeElements && emphasizeElements(hilitedIds, undefined);
    if (!hiddenGroupsIds.includes(group.id)) {
      allIds = allIds.concat(hilitedIds);
    }
  }

  await zoomToElements(allIds);
};

export const getHiliteIdsAndKeysetFromGroup = async (
  iModelConnection: IModelConnection,
  group: Group,
  hilitedElementsQueryCache: React.MutableRefObject<Map<string, { keySet: KeySet, ids: string[] }>>
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
