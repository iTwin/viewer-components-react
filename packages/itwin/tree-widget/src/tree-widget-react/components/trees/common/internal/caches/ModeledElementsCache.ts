/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { defer, EMPTY, from, map, mergeMap, of, reduce, shareReplay, toArray } from "rxjs";
import { Guid, Id64 } from "@itwin/core-bentley";
import { catchBeSQLiteInterrupts } from "../UseErrorState.js";

import type { Observable } from "rxjs";
import type { GuidString, Id64Arg, Id64Array, Id64String } from "@itwin/core-bentley";
import type { LimitingECSqlQueryExecutor } from "@itwin/presentation-hierarchies";
import type { CategoryId, ElementId, ModelId } from "../Types.js";

interface ModeledElementsCacheProps {
  queryExecutor: LimitingECSqlQueryExecutor;
  componentId?: GuidString;
  elementClassName: string;
  modelClassName: string;
  viewType: "2d" | "3d";
}

/** @internal */
export class ModeledElementsCache {
  #queryExecutor: LimitingECSqlQueryExecutor;
  #componentId: GuidString;
  #componentName: string;
  #elementsClassName: string;
  #modelClassName: string;
  // ElementId here is also a ModelId, since those elements are sub models.
  #modeledElementsInfo:
    | Observable<{ modelWithCategoryModeledElements: Map<ModelId, Map<CategoryId, Set<ElementId>>>; allSubModels: Set<ElementId> }>
    | undefined;

  constructor(props: ModeledElementsCacheProps) {
    this.#queryExecutor = props.queryExecutor;
    this.#componentId = props.componentId ?? Guid.createValue();
    this.#componentName = `ModeledElementsCache${props.viewType}`;
    this.#elementsClassName = props.elementClassName;
    this.#modelClassName = props.modelClassName;
  }

  private queryModeledElements(): Observable<{
    modelId: Id64String;
    modeledElementId: Id64String;
    categoryId: Id64String;
  }> {
    return defer(() => {
      const query = `
        SELECT
          pe.ECInstanceId modeledElementId,
          pe.Category.Id categoryId,
          pe.Model.Id modelId
        FROM ${this.#modelClassName} m
        JOIN ${this.#elementsClassName} pe ON pe.ECInstanceId = m.ModeledElement.Id
        WHERE
          m.IsPrivate = false
          AND m.ECInstanceId IN (SELECT Model.Id FROM ${this.#elementsClassName})
      `;
      return this.#queryExecutor.createQueryReader(
        { ecsql: query },
        { rowFormat: "ECSqlPropertyNames", limit: "unbounded", restartToken: `${this.#componentName}/${this.#componentId}/modeled-elements` },
      );
    }).pipe(
      catchBeSQLiteInterrupts,
      map((row) => {
        return { modelId: row.modelId, categoryId: row.categoryId, modeledElementId: row.modeledElementId };
      }),
    );
  }

  public getModeledElementsInfo() {
    this.#modeledElementsInfo ??= this.queryModeledElements().pipe(
      reduce(
        (acc, { modelId, categoryId, modeledElementId }) => {
          let modelEntry = acc.modelWithCategoryModeledElements.get(modelId);
          if (!modelEntry) {
            modelEntry = new Map();
            acc.modelWithCategoryModeledElements.set(modelId, modelEntry);
          }
          const categoryEntry = modelEntry.get(categoryId);
          if (!categoryEntry) {
            modelEntry.set(categoryId, new Set([modeledElementId]));
          } else {
            categoryEntry.add(modeledElementId);
          }
          acc.allSubModels.add(modeledElementId);
          return acc;
        },
        { modelWithCategoryModeledElements: new Map<ModelId, Map<CategoryId, Set<ElementId>>>(), allSubModels: new Set<ElementId>() },
      ),
      shareReplay(),
    );
    return this.#modeledElementsInfo;
  }

  public hasSubModel(elementId: Id64String): Observable<boolean> {
    return this.getModeledElementsInfo().pipe(map(({ allSubModels }) => allSubModels.has(elementId)));
  }

  public getCategoriesModeledElements({ modelId, categoryIds }: { modelId: Id64String; categoryIds: Id64Arg }): Observable<Id64Array> {
    if (Id64.sizeOf(categoryIds) === 0) {
      return of([]);
    }
    return this.getModeledElementsInfo().pipe(
      mergeMap(({ modelWithCategoryModeledElements }) => {
        const result = new Array<ElementId>();
        const categoryMap = modelWithCategoryModeledElements.get(modelId);
        if (!categoryMap) {
          return of(result);
        }
        return from(Id64.iterable(categoryIds)).pipe(
          map((categoryId) => categoryMap.get(categoryId)),
          mergeMap((elementsSet) => (elementsSet ? from(elementsSet) : EMPTY)),
          toArray(),
        );
      }),
    );
  }
}
