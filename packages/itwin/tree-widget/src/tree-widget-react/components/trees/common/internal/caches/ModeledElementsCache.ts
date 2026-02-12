/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { defer, map, mergeMap, reduce, shareReplay } from "rxjs";
import { Guid } from "@itwin/core-bentley";
import { catchBeSQLiteInterrupts } from "../UseErrorState.js";

import type { Observable } from "rxjs";
import type { GuidString, Id64Array, Id64String } from "@itwin/core-bentley";
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
    | Observable<{
        modelWithCategoryModeledElements: Map<ModelId, Map<CategoryId, Set<ElementId>>>;
        allSubModels: Set<ElementId>;
        childSubModels: Map<ElementId, Set<ElementId>>;
      }>
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
    parentElements: Id64Array;
  }> {
    return defer(() => {
      const query = `
        SELECT
          me.ECInstanceId modeledElementId,
          me.Category.Id categoryId,
          me.Model.Id modelId,
          IIF(me.Parent.Id IS NULL,
            '',
            (
              WITH RECURSIVE ModeledElementParents(parentId, parentPath) AS (
                SELECT p.Parent.Id, CAST(IdToHex(p.ECInstanceId) AS TEXT)
                FROM ${this.#elementsClassName} p
                WHERE p.ECInstanceId = me.Parent.Id
                UNION ALL
                SELECT pOfp.Parent.Id, CAST(IdToHex(pOfp.ECInstanceId) AS TEXT) || ';' || c.parentPath
                FROM ${this.#elementsClassName} pOfp
                JOIN ModeledElementParents c ON c.parentId = pOfp.ECInstanceId
              )
              SELECT parentPath
              FROM ModeledElementParents
              WHERE parentId IS NULL
            )
          ) parentElements
        FROM ${this.#modelClassName} m
        JOIN ${this.#elementsClassName} me ON me.ECInstanceId = m.ModeledElement.Id
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
        return { modelId: row.modelId, categoryId: row.categoryId, modeledElementId: row.modeledElementId, parentElements: row.parentElements.split(";") };
      }),
    );
  }

  public getModeledElementsInfo() {
    this.#modeledElementsInfo ??= this.queryModeledElements().pipe(
      reduce(
        (acc, { modelId, categoryId, modeledElementId, parentElements }) => {
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
          parentElements.forEach((parentElementId) => {
            const entry = acc.childSubModels.get(parentElementId);
            if (!entry) {
              acc.childSubModels.set(parentElementId, new Set([modeledElementId]));
            } else {
              entry.add(modeledElementId);
            }
          });
          return acc;
        },
        {
          modelWithCategoryModeledElements: new Map<ModelId, Map<CategoryId, Set<ElementId>>>(),
          allSubModels: new Set<ElementId>(),
          childSubModels: new Map<ElementId, Set<ElementId>>(),
        },
      ),
      shareReplay(),
    );
    return this.#modeledElementsInfo;
  }

  public getSubModelsUnderElement(elementId: Id64String): Observable<Id64Array> {
    return this.getModeledElementsInfo().pipe(
      map(({ allSubModels, childSubModels }) => {
        const subModels = new Array<ElementId>();
        if (allSubModels.has(elementId)) {
          subModels.push(elementId);
        }
        const elementEntry = childSubModels.get(elementId);
        elementEntry?.forEach((childSubModelId) => {
          subModels.push(childSubModelId);
        });
        return subModels;
      }),
    );
  }

  public getCategoryModeledElements({ modelId, categoryId }: { modelId: Id64String; categoryId: Id64String }): Observable<Id64String> {
    return this.getModeledElementsInfo().pipe(
      mergeMap(({ modelWithCategoryModeledElements }) => modelWithCategoryModeledElements.get(modelId)?.get(categoryId) ?? new Set<Id64String>()),
    );
  }
}
