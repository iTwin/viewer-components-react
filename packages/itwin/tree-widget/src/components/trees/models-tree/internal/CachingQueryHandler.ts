/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { shareReplay } from "rxjs";

import type { Id64Array, Id64Set, Id64String } from "@itwin/core-bentley";
import type { IQueryHandler } from "./QueryHandler";
import type { Observable } from "rxjs";

export type ICachingQueryHandler = IQueryHandler;

export function createCachingQueryHandler(source: IQueryHandler) {
  return new CachingQueryHandlerImpl(source);
}

class CachingQueryHandlerImpl implements ICachingQueryHandler {
  private _allSubjectsCache?: Observable<{ id: string; parentId?: string | undefined; targetPartitionId?: string | undefined }>;
  private _allModelsCache?: Observable<{ id: string; parentId: string }>;
  private readonly _modelCategoriesCache = new Map<string, Observable<Id64String>>();
  private readonly _categoryElementsCache = new Map<string, Observable<{ id: Id64String; hasChildren: boolean }>>();

  constructor(private readonly _source: IQueryHandler) {}

  public queryAllSubjects(): Observable<{ id: string; parentId?: string | undefined; targetPartitionId?: string | undefined }> {
    return (this._allSubjectsCache ??= this._source.queryAllSubjects().pipe(shareReplay()));
  }

  public queryAllModels(): Observable<{ id: string; parentId: string }> {
    return (this._allModelsCache ??= this._source.queryAllModels().pipe(shareReplay()));
  }

  private getFromCacheOrInsert<T>(key: string, cache: Map<string, Observable<T>>, factory: () => Observable<T>): Observable<T> {
    let res = cache.get(key);
    if (res === undefined) {
      res = factory().pipe(shareReplay());
      cache.set(key, res);
    }
    return res;
  }

  public queryModelCategories(id: string): Observable<string> {
    return this.getFromCacheOrInsert(id, this._modelCategoriesCache, () => this._source.queryModelCategories(id));
  }

  public queryModelElementsCount(modelId: string): Observable<number> {
    return this._source.queryModelElementsCount(modelId);
  }

  public queryCategoryElements(id: string, modelId: string | undefined): Observable<{ id: string; hasChildren: boolean }> {
    return this.getFromCacheOrInsert(id, this._categoryElementsCache, () => this._source.queryCategoryElements(id, modelId));
  }

  public queryModelElements(modelId: Id64String, elementIds?: Id64Array | Id64Set): Observable<Id64String> {
    return this._source.queryModelElements(modelId, elementIds);
  }
}
