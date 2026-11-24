/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { defer, EMPTY, from, map, merge, mergeMap, of, reduce, shareReplay } from "rxjs";
import { Guid, Id64 } from "@itwin/core-bentley";
import { createCategoriesTreeIdsProvider as createTreeDefinitionsCategoriesTreeIdsProvider } from "@itwin/presentation-tree-definitions";
import { catchBeSQLiteInterrupts } from "../../../shared/internal/hooks/UseErrorState.js";
import { toObservable, toVoidPromise } from "../../../shared/internal/Rxjs.js";
import { extendObject, getClassesByPerspective } from "../../../shared/internal/Utils.js";

import type { Observable } from "rxjs";
import type { Id64Arg, Id64Array } from "@itwin/core-bentley";
import type { LimitingECSqlQueryExecutor } from "@itwin/presentation-hierarchies";
import type { ECSchemaProvider, Subscribable } from "@itwin/presentation-shared";
import type { CategoriesTreeIdsProvider as TreeDefinitionsCategoriesTreeIdsProvider } from "@itwin/presentation-tree-definitions";
import type { SharedIdsProvider } from "../../../shared/internal/idsProviders/SharedIdsProvider.js";
import type { CategoryId, ElementId, ModelId } from "../../../shared/internal/Types.js";

type CachedCategoryInfo =
  ReturnType<TreeDefinitionsCategoriesTreeIdsProvider["getDirectChildDefinitionContainersAndCategories"]> extends Subscribable<{
    categories: ReadonlyArray<infer TCategory>;
  }>
    ? TCategory
    : never;

/**
 * Provides definition container, category and sub-category IDs and search paths for categories tree hierarchy, as well as
 * additional data required by tree widget.
 * @internal
 */
export interface CategoriesTreeIdsProvider extends TreeDefinitionsCategoriesTreeIdsProvider {
  /** Starts loading definition containers and categories data, if it's not loaded yet. */
  preloadDefinitionContainers(): Promise<void>;
  /** Returns all categories contained in the given definition containers, including categories of nested definition containers. */
  getAllContainedCategories(props: {
    definitionContainerIds: Id64Arg;
  }): Observable<{ id: CategoryId; hasElements: boolean; isTopMostElementCategory: boolean }>;
  /** Returns models of the given filtered elements. The result is cached until `clearFilteredElementsModels` is called. */
  getFilteredElementsModels(filteredElementIds: Id64Array): Observable<Map<ElementId, ModelId>>;
  /** Clears cache of `getFilteredElementsModels`. */
  clearFilteredElementsModels(): void;
}

/**
 * Creates categories tree ids provider, which uses data of the given `SharedIdsProvider`.
 * @internal
 */
export function createCategoriesTreeIdsProvider(props: {
  imodelAccess: ECSchemaProvider & LimitingECSqlQueryExecutor;
  perspective: "2d" | "3d";
  sharedIdsProvider: SharedIdsProvider;
}): CategoriesTreeIdsProvider {
  const { imodelAccess, perspective, sharedIdsProvider } = props;
  const treeDefinitionsIdsProvider = createTreeDefinitionsCategoriesTreeIdsProvider({
    imodelAccess,
    hierarchyConfig: { perspective },
    sharedIdsProvider,
  });
  const componentId = Guid.createValue();
  const componentName = "CategoriesTreeIdsProvider";
  const { elementClass } = getClassesByPerspective(perspective);
  let filteredElementsModels: Observable<Map<ElementId, ModelId>> | undefined;

  function getContainedCategories(definitionContainerIds: Id64Arg): Observable<CachedCategoryInfo> {
    return toObservable(
      treeDefinitionsIdsProvider.getDirectChildDefinitionContainersAndCategories({ parentDefinitionContainerIds: definitionContainerIds, includeEmpty: true }),
    ).pipe(
      mergeMap(({ categories, definitionContainers }) =>
        merge(definitionContainers.length > 0 ? getContainedCategories([...definitionContainers]) : EMPTY, from(categories)),
      ),
    );
  }

  function queryFilteredElementsModels(filteredElementIds: Id64Array): Observable<{ modelId: ModelId; id: ElementId }> {
    return defer(() => {
      const query = `
        SELECT Model.Id modelId, ECInstanceId id
        FROM ${elementClass}
        JOIN IdSet(?) filteredElementIdSet ON ECInstanceId = filteredElementIdSet.id
      `;
      return imodelAccess.createQueryReader(
        { ecsql: query, bindings: [{ type: "idset", value: filteredElementIds }] },
        {
          rowFormat: "ECSqlPropertyNames",
          limit: "unbounded",
          restartToken: `${componentName}/${componentId}/filtered-element-models/${Guid.createValue()}`,
        },
      );
    }).pipe(
      catchBeSQLiteInterrupts,
      map((row) => ({ modelId: row.modelId, id: row.id })),
    );
  }

  return extendObject({
    base: treeDefinitionsIdsProvider,
    extension: {
      preloadDefinitionContainers: async () => {
        if (treeDefinitionsIdsProvider.state !== "not-requested") {
          return;
        }
        try {
          await toVoidPromise(toObservable(treeDefinitionsIdsProvider.getAllDefinitionContainersAndCategories({ includeEmpty: true })));
        } catch {}
      },
      getAllContainedCategories: ({ definitionContainerIds }: { definitionContainerIds: Id64Arg }) =>
        sharedIdsProvider.categories
          .getAllCategoriesOfTopMostElements()
          .pipe(
            mergeMap((categoriesOfTopMostElements) =>
              getContainedCategories(definitionContainerIds).pipe(
                map(({ id, hasElements }) => ({ id, hasElements, isTopMostElementCategory: categoriesOfTopMostElements.has(id) })),
              ),
            ),
          ),
      getFilteredElementsModels: (filteredElementIds: Id64Array) => {
        if (Id64.sizeOf(filteredElementIds) === 0) {
          return of(new Map<ElementId, ModelId>());
        }
        filteredElementsModels ??= queryFilteredElementsModels(filteredElementIds).pipe(
          reduce((acc, { modelId, id }) => acc.set(id, modelId), new Map<ElementId, ModelId>()),
          shareReplay(),
        );
        return filteredElementsModels;
      },
      clearFilteredElementsModels: () => {
        filteredElementsModels = undefined;
      },
    },
  });
}
