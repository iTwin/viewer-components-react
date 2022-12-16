/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { FeatureOverrideType } from "@itwin/core-common";
import type { IModelConnection } from "@itwin/core-frontend";
import type { Group } from "@itwin/insights-client";
import { toaster } from "@itwin/itwinui-react";
import { clearEmphasizedOverriddenElements, emphasizeElements, getHiliteIds, hideElements, hideElementsByQuery, overrideElements, zoomToElements } from "./viewerUtils";

const goldenAngle = 180 * (3 - Math.sqrt(5));

const getGroupColor = function (index: number) {
  return `hsl(${index * goldenAngle + 60}, 100%, 50%)`;
};

export const getHiliteIdsFromGroups = async (
  iModelConnection: IModelConnection,
  groups: Group[],
  hilitedElementsQueryCache: React.MutableRefObject<Map<string, string[]>>
) => {
  let allIds: string[] = [];
  for (const group of groups) {
    const query = group.query;
    let currentIds: string[] = [];
    if (hilitedElementsQueryCache.current.has(query)) {
      currentIds = hilitedElementsQueryCache.current.get(query) ?? [];
    } else {
      try {
        const queryRowCount = await iModelConnection.queryRowCount(query);
        if (queryRowCount === 0) {
          toaster.warning(
            `${group.groupName}'s query is valid but produced no results.`
          );
        }
        currentIds = await getHiliteIds(query, iModelConnection);
        hilitedElementsQueryCache.current.set(query, currentIds);
      } catch {
        toaster.negative(
          `Could not hide/show ${group.groupName}. Query could not be resolved.`
        );
      }
    }
    allIds = allIds.concat(currentIds);
  }
  return allIds;
};

export const hideGroups = async (
  iModelConnection: IModelConnection,
  viewGroups: Group[],
  hilitedElementsQueryCache: React.MutableRefObject<Map<string, string[]>>
) => {
  for (const viewGroup of viewGroups) {
    const query = viewGroup.query;
    if (hilitedElementsQueryCache.current.has(query)) {
      const hilitedIds = hilitedElementsQueryCache.current.get(query) ?? [];
      hideElements(hilitedIds);
    } else {
      try {
        const queryRowCount = await iModelConnection.queryRowCount(query);
        if (queryRowCount === 0) {
          toaster.warning(
            `${viewGroup.groupName}'s query is valid but produced no results.`
          );
        }
        const hiliteIds = await hideElementsByQuery(
          query,
          iModelConnection,
          false
        );
        hilitedElementsQueryCache.current.set(query, hiliteIds);
      } catch {
        toaster.negative(
          `Could not hide/show ${viewGroup.groupName}. Query could not be resolved.`
        );
      }
    }
  }
};

export const visualizeGroupColors = async (
  iModelConnection: IModelConnection,
  groups: Group[],
  viewGroups: Group[],
  hiddenGroupsIds: string[],
  hilitedElementsQueryCache: React.MutableRefObject<Map<string, string[]>>
) => {
  clearEmphasizedOverriddenElements();
  let allIds: string[] = [];
  for (const group of viewGroups) {
    const index =
      viewGroups.length > groups.length
        ? viewGroups.findIndex((g) => g.id === group.id)
        : groups.findIndex((g) => g.id === group.id);
    const hilitedIds = await getHiliteIdsFromGroups(iModelConnection, [group], hilitedElementsQueryCache);
    overrideElements(
      hilitedIds,
      getGroupColor(index),
      FeatureOverrideType.ColorAndAlpha,
    );
    emphasizeElements(hilitedIds, undefined);
    if (!hiddenGroupsIds.includes(group.id)) {
      allIds = allIds.concat(hilitedIds);
    }
  }

  await zoomToElements(allIds);
};
