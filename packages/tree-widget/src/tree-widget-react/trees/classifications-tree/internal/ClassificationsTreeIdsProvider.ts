/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { defer, EMPTY, forkJoin, from, map, merge, mergeMap, of, reduce, shareReplay } from "rxjs";
import { Guid, Id64 } from "@itwin/core-bentley";
import { createClassificationsTreeIdsProvider as createTreeDefinitionsClassificationsTreeIdsProvider } from "@itwin/presentation-tree-definitions";
import { CLASS_NAMES } from "../../../shared/internal/ClassNameDefinitions.js";
import { catchBeSQLiteInterrupts } from "../../../shared/internal/hooks/UseErrorState.js";
import { toObservable, toVoidPromise } from "../../../shared/internal/Rxjs.js";
import { createWhereClause, extendObject, getOrCreate } from "../../../shared/internal/Utils.js";

import type { Observable } from "rxjs";
import type { Id64Arg, Id64Array, Id64String } from "@itwin/core-bentley";
import type { LimitingECSqlQueryExecutor } from "@itwin/presentation-hierarchies";
import type { ECSchemaProvider } from "@itwin/presentation-shared";
import type { ClassificationsTreeIdsProvider as TreeDefinitionsClassificationsTreeIdsProvider } from "@itwin/presentation-tree-definitions";
import type { CategoryId, ClassificationId, ElementId } from "../../../shared/internal/Types.js";
import type { ClassificationsTreeHierarchyConfiguration } from "../ClassificationsTreeDefinition.js";
import type { ClassificationsTreeVisibilityHandlerConfiguration } from "../UseClassificationsTree.js";

/**
 * Hierarchy config props needed for ids provider.
 * @internal
 */
export type HierarchyConfigForClassificationsTreeIdsProvider = Pick<ClassificationsTreeHierarchyConfiguration, "rootClassificationSystemCode" | "elements">;

/**
 * Visibility handler config props needed for ids provider.
 * @internal
 */
export type VisibilityHandlerConfigForClassificationsTreeIdsProvider = Pick<
  ClassificationsTreeVisibilityHandlerConfiguration,
  "classificationToCategoriesRelationshipSpecification"
>;

/**
 * Provides classification table and classification IDs and search paths for classifications tree hierarchy, as well as
 * additional data required by tree widget.
 * @internal
 */
export interface ClassificationsTreeIdsProvider extends TreeDefinitionsClassificationsTreeIdsProvider {
  /** Starts loading classifications data, if it's not loaded yet. */
  preloadClassifications(): Promise<void>;
  /** Returns categories related to the given classifications, classification tables and their child classifications. */
  getAllContainedCategories(classificationOrTableIds: Id64Arg): Observable<CategoryId>;
  /** Returns models and categories of the given filtered elements. The result is cached until `clearFilteredElementsData` is called. */
  getFilteredElementsData(props: { elementIds: Id64Array }): Observable<Map<ElementId, { categoryId: Id64String; modelId: Id64String }>>;
  /** Clears cache of `getFilteredElementsData`. */
  clearFilteredElementsData(): void;
}

/**
 * Creates classifications tree ids provider.
 * @internal
 */
export function createClassificationsTreeIdsProvider(props: {
  imodelAccess: ECSchemaProvider & LimitingECSqlQueryExecutor;
  hierarchyConfig: HierarchyConfigForClassificationsTreeIdsProvider;
  visibilityHandlerConfig?: VisibilityHandlerConfigForClassificationsTreeIdsProvider;
}): ClassificationsTreeIdsProvider {
  const { imodelAccess, hierarchyConfig, visibilityHandlerConfig } = props;
  const treeDefinitionsIdsProvider = createTreeDefinitionsClassificationsTreeIdsProvider({
    imodelAccess,
    hierarchyConfig: { rootClassificationSystemCode: hierarchyConfig.rootClassificationSystemCode },
  });
  const componentId = Guid.createValue();
  const componentName = "ClassificationsTreeIdsProvider";
  let cachedClassificationCategories: Observable<Map<ClassificationId, CategoryId[]>> | undefined;
  let filteredElementsData: Observable<Map<ElementId, { categoryId: Id64String; modelId: Id64String }>> | undefined;

  // By default, classification is related to categories of top-most elements classified by it. This can be overridden
  // with `classificationToCategoriesRelationshipSpecification`.
  function queryClassificationCategories(): Observable<{ classificationId: ClassificationId; categoryId: CategoryId }> {
    return defer(() => {
      const relationshipSpecification = visibilityHandlerConfig?.classificationToCategoriesRelationshipSpecification;
      let ecsql: string;
      if (relationshipSpecification) {
        const { categoryAccessor, classificationAccessor } =
          relationshipSpecification.source === "classification"
            ? { classificationAccessor: "SourceECInstanceId", categoryAccessor: "TargetECInstanceId" }
            : { classificationAccessor: "TargetECInstanceId", categoryAccessor: "SourceECInstanceId" };
        ecsql = `
          SELECT DISTINCT rel.${classificationAccessor} classificationId, cat.ECInstanceId categoryId
          FROM ${CLASS_NAMES.SpatialCategory} cat
          JOIN ${relationshipSpecification.fullClassName} rel ON rel.${categoryAccessor} = cat.ECInstanceId
          WHERE NOT cat.IsPrivate
        `;
      } else {
        ecsql = `
          SELECT DISTINCT ehc.TargetECInstanceId classificationId, cat.ECInstanceId categoryId
          FROM ${CLASS_NAMES.GeometricElement3d} e
          JOIN ${CLASS_NAMES.Model} m ON m.ECInstanceId = e.Model.Id
          JOIN ${CLASS_NAMES.SpatialCategory} cat ON cat.ECInstanceId = e.Category.Id
          JOIN ${CLASS_NAMES.ElementHasClassifications} ehc ON ehc.SourceECInstanceId = e.ECInstanceId
          ${createWhereClause({ conditions: ["e.Parent.Id IS NULL", "NOT cat.IsPrivate", "NOT m.IsPrivate", "NOT m.IsTemplate"] })}
        `;
      }
      return imodelAccess.createQueryReader(
        { ecsql },
        { rowFormat: "ECSqlPropertyNames", limit: "unbounded", restartToken: `${componentName}/${componentId}/classification-categories` },
      );
    }).pipe(
      catchBeSQLiteInterrupts,
      map((row) => ({ classificationId: row.classificationId, categoryId: row.categoryId })),
    );
  }

  function getClassificationCategories(): Observable<Map<ClassificationId, CategoryId[]>> {
    cachedClassificationCategories ??= queryClassificationCategories().pipe(
      reduce((acc, { classificationId, categoryId }) => {
        getOrCreate({ map: acc, key: classificationId, createFunc: () => new Array<CategoryId>() }).push(categoryId);
        return acc;
      }, new Map<ClassificationId, CategoryId[]>()),
      shareReplay(),
    );
    return cachedClassificationCategories;
  }

  function getAllContainedCategories(classificationOrTableIds: Id64Arg): Observable<CategoryId> {
    if (Id64.sizeOf(classificationOrTableIds) === 0) {
      return EMPTY;
    }
    return forkJoin({
      classificationCategories: getClassificationCategories(),
      childClassifications: toObservable(treeDefinitionsIdsProvider.getDirectChildClassifications(classificationOrTableIds)),
    }).pipe(
      mergeMap(({ classificationCategories, childClassifications }) =>
        merge(
          from(Id64.iterable(classificationOrTableIds)).pipe(mergeMap((id) => classificationCategories.get(id) ?? EMPTY)),
          childClassifications.length > 0 ? getAllContainedCategories(childClassifications.map(({ id }) => id)) : EMPTY,
        ),
      ),
    );
  }

  function queryFilteredElementsData(elementIds: Id64Array): Observable<{ modelId: Id64String; id: ElementId; categoryId: Id64String }> {
    return defer(() => {
      const query = `
        SELECT
          this.Model.Id modelId,
          this.Category.Id categoryId,
          this.ECInstanceId id
        FROM ${CLASS_NAMES.GeometricElement3d} this
        JOIN IdSet(?) elementIdSet ON ECInstanceId = elementIdSet.id
      `;
      return imodelAccess.createQueryReader(
        { ecsql: query, bindings: [{ type: "idset", value: elementIds }] },
        {
          rowFormat: "ECSqlPropertyNames",
          limit: "unbounded",
          restartToken: `${componentName}/${componentId}/filtered-elements/${Guid.createValue()}`,
        },
      );
    }).pipe(
      catchBeSQLiteInterrupts,
      map((row) => ({ modelId: row.modelId, id: row.id, categoryId: row.categoryId })),
    );
  }

  return extendObject({
    base: treeDefinitionsIdsProvider,
    extension: {
      preloadClassifications: async () => {
        if (treeDefinitionsIdsProvider.state !== "not-requested") {
          return;
        }
        try {
          await toVoidPromise(toObservable(treeDefinitionsIdsProvider.getAllClassifications()));
        } catch {}
      },
      getAllContainedCategories,
      getFilteredElementsData: ({ elementIds }: { elementIds: Id64Array }) => {
        if (Id64.sizeOf(elementIds) === 0) {
          return of(new Map());
        }
        filteredElementsData ??= queryFilteredElementsData(elementIds).pipe(
          reduce(
            (acc, { modelId, id, categoryId }) => acc.set(id, { modelId, categoryId }),
            new Map<ElementId, { categoryId: Id64String; modelId: Id64String }>(),
          ),
          shareReplay(),
        );
        return filteredElementsData;
      },
      clearFilteredElementsData: () => {
        filteredElementsData = undefined;
      },
    },
  });
}
