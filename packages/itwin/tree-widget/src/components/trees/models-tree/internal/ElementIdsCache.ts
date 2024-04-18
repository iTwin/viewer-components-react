/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import type { Observable } from "rxjs";
import { first, from, map, mergeMap, shareReplay } from "rxjs";
import { QueryBinder, QueryRowFormat } from "@itwin/core-common";
import { KeySet } from "@itwin/presentation-common";
import { Presentation } from "@itwin/presentation-frontend";

import type { GroupingNodeKey, Keys } from "@itwin/presentation-common";
import type { Id64String } from "@itwin/core-bentley";
import type { IModelConnection } from "@itwin/core-frontend";
interface GroupedElementIds {
  modelId?: string;
  categoryId?: string;
  elementIds: Observable<string>;
}

export interface ElementIdsCache {
  clear(): void;
  getAssemblyElementIds(assemblyId: Id64String): Observable<string>;
  getGroupedElementIds(groupingNodeKey: GroupingNodeKey): Observable<GroupedElementIds>;
}

// istanbul ignore next
export function createElementIdsCache(iModel: IModelConnection, rulesetId: string) {
  return new ElementIdsCacheImplementation(iModel, rulesetId);
}

// istanbul ignore next
class ElementIdsCacheImplementation {
  private _assemblyElementIdsCache = new Map<string, Observable<string>>();
  private _groupedElementIdsCache = new Map<string, Observable<GroupedElementIds>>();

  constructor(
    private _imodel: IModelConnection,
    private _rulesetId: string,
  ) {}

  public clear() {
    this._assemblyElementIdsCache.clear();
    this._groupedElementIdsCache.clear();
  }

  public getAssemblyElementIds(assemblyId: Id64String): Observable<string> {
    const ids = this._assemblyElementIdsCache.get(assemblyId);
    if (ids) {
      return ids;
    }

    const obs = createAssemblyElementIdsObs(this._imodel, this._rulesetId, assemblyId);
    this._assemblyElementIdsCache.set(assemblyId, obs);
    return obs;
  }

  public getGroupedElementIds(groupingNodeKey: GroupingNodeKey): Observable<GroupedElementIds> {
    const keyString = JSON.stringify(groupingNodeKey);
    const ids = this._groupedElementIdsCache.get(keyString);
    if (ids) {
      return ids;
    }
    const info = createGroupedElementsInfo(this._imodel, this._rulesetId, groupingNodeKey);
    this._groupedElementIdsCache.set(keyString, info);
    return info;
  }
}

// istanbul ignore next
function createInstanceIdsObs(imodel: IModelConnection, rulesetId: string, displayType: string, inputKeys: Keys): Observable<string> {
  return from(
    Presentation.presentation.getContentInstanceKeys({
      imodel,
      rulesetOrId: rulesetId,
      displayType,
      keys: new KeySet(inputKeys),
    }),
  ).pipe(
    mergeMap((x) => x.items()),
    map((x) => x.id),
    shareReplay(),
  );
}

// istanbul ignore next
function createAssemblyElementIdsObs(imodel: IModelConnection, rulesetId: string, assemblyId: Id64String): Observable<string> {
  return createInstanceIdsObs(imodel, rulesetId, "AssemblyElementsRequest", [{ className: "BisCore:Element", id: assemblyId }]);
}

// istanbul ignore next
function createGroupedElementsInfo(imodel: IModelConnection, rulesetId: string, groupingNodeKey: GroupingNodeKey): Observable<GroupedElementIds> {
  const groupedElementsIdObs = createInstanceIdsObs(imodel, rulesetId, "AssemblyElementsRequest", [groupingNodeKey]).pipe(first());
  const query = `SELECT Model.Id AS modelId, Category.Id AS categoryId FROM bis.GeometricElement3d WHERE ECInstanceId = ? LIMIT 1`;
  return groupedElementsIdObs.pipe(
    mergeMap((elementId) => imodel.createQueryReader(query, QueryBinder.from([elementId]), { rowFormat: QueryRowFormat.UseJsPropertyNames })),
    first(),
    map((row) => ({ modelId: row.modelId, categoryId: row.categoryId, elementIds: groupedElementsIdObs })),
    shareReplay(),
  );
}
