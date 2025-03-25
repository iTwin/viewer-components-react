/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { filter, from, map, mergeMap, of, startWith, toArray } from "rxjs";
import { reduceWhile } from "../Rxjs.js";
import { createVisibilityStatus } from "../Tooltip.js";

import type { Id64Array, Id64String } from "@itwin/core-bentley";
import type { Observable, OperatorFunction } from "rxjs";
import type { Visibility } from "../Tooltip.js";
import type { VisibilityStatus } from "../UseHierarchyVisibility.js";

/** @internal */
export function mergeVisibilities(obs: Observable<Visibility>): Observable<Visibility | "empty"> {
  return obs.pipe(
    reduceWhile(
      (x) => x.allVisible || x.allHidden,
      (acc, val) => {
        acc.allVisible &&= val === "visible";
        acc.allHidden &&= val === "hidden";
        return acc;
      },
      { allVisible: true, allHidden: true },
    ),
    map((x) => {
      if (!x) {
        return "empty";
      }
      return x.allVisible ? "visible" : x.allHidden ? "hidden" : "partial";
    }),
  );
}

/** @internal */
export function mergeVisibilityStatuses(
  tooltipMap: { [key in Visibility]: string | undefined },
  ignoreTooltip?: boolean,
): OperatorFunction<VisibilityStatus, VisibilityStatus> {
  return (obs) => {
    return obs.pipe(
      map((visibilityStatus) => visibilityStatus.state),
      mergeVisibilities,
      map((visibility) => {
        if (visibility === "empty") {
          visibility = "visible";
        }
        return createVisibilityStatus(visibility, getTooltipOptions(tooltipMap[visibility], ignoreTooltip));
      }),
    );
  };
}


/** @internal */
export function getTooltipOptions(key: string | undefined, ignoreTooltip?: boolean) {
  return {
    useTooltip: ignoreTooltip ? (false as const) : key,
  };
}

/** @internal */
export function getSubModeledElementsVisibilityStatus({
    parentNodeVisibilityStatus,
    haveSubModel,
    tooltips,
    ignoreTooltips,
    getModelVisibilityStatus,
    doesSubModelExist
  }: {
    parentNodeVisibilityStatus: VisibilityStatus;
    haveSubModel: "yes" | "unknown";
    getModelVisibilityStatus: ({modelId}: {modelId: Id64String}) => Observable<VisibilityStatus>;
    doesSubModelExist: (elementId: Id64String) => Promise<boolean>;
    tooltips: { [key in Visibility]: string | undefined };
    ignoreTooltips?: boolean;
  }): OperatorFunction<Id64Array, VisibilityStatus> {
    return (obs) => {
      return obs.pipe(
        // ensure we're only looking at elements that have a sub-model
        mergeMap((modeledElementIds) => {
          if (haveSubModel === "yes") {
            return of(modeledElementIds);
          }
          return from(modeledElementIds).pipe(
            mergeMap(async (elementId) => ({ elementId, hasSubModel: await doesSubModelExist(elementId) })),
            filter(({ hasSubModel }) => hasSubModel),
            map(({ elementId }) => elementId),
            toArray(),
          );
        }),
        // combine visibility status of sub-models with visibility status of parent node
        mergeMap((modeledElementIds) => {
          if (modeledElementIds.length === 0) {
            return of(parentNodeVisibilityStatus);
          }
          return from(modeledElementIds).pipe(
            mergeMap((modeledElementId) => getModelVisibilityStatus({ modelId: modeledElementId })),
            startWith<VisibilityStatus>(parentNodeVisibilityStatus),
            mergeVisibilityStatuses(tooltips, ignoreTooltips),
          );
        }),
      );
    };
  }
