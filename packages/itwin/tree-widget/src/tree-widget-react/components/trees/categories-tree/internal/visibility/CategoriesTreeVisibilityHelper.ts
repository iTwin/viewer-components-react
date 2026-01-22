/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { concat, defer, EMPTY, from, map, mergeMap, reduce } from "rxjs";
import { HierarchyNodeKey } from "@itwin/presentation-hierarchies";
import {
  CLASS_NAME_GeometricElement2d,
  CLASS_NAME_GeometricElement3d,
  CLASS_NAME_GeometricModel2d,
  CLASS_NAME_GeometricModel3d,
} from "../../../common/internal/ClassNameDefinitions.js";
import { getIdsFromChildrenTree } from "../../../common/internal/Utils.js";
import { BaseVisibilityHelper } from "../../../common/internal/visibility/BaseVisibilityHelper.js";
import { enableCategoryDisplay, mergeVisibilityStatuses } from "../../../common/internal/VisibilityUtils.js";

import type { Observable } from "rxjs";
import type { Id64Arg, Id64String } from "@itwin/core-bentley";
import type { InstanceKey } from "@itwin/presentation-shared";
import type { CategoryId, ElementId, ModelId } from "../../../common/internal/Types.js";
import type { BaseVisibilityHelperProps } from "../../../common/internal/visibility/BaseVisibilityHelper.js";
import type { VisibilityStatus } from "../../../common/UseHierarchyVisibility.js";
import type { CategoriesTreeHierarchyConfiguration } from "../../CategoriesTreeDefinition.js";
import type { CategoriesTreeIdsCache } from "../CategoriesTreeIdsCache.js";
import type { CategoriesTreeSearchTargets } from "./SearchResultsTree.js";

/** @internal */
export type CategoriesTreeVisibilityHelperProps = BaseVisibilityHelperProps<CategoriesTreeSearchTargets> & {
  idsCache: CategoriesTreeIdsCache;
  hierarchyConfig: CategoriesTreeHierarchyConfiguration;
};

/**
 * Visibility status helper for categories tree.
 *
 * It extends base visibility status helper and provides methods to get and change visibility status of definition containers and grouped elements.
 * @internal
 */
export class CategoriesTreeVisibilityHelper extends BaseVisibilityHelper<CategoriesTreeSearchTargets> {
  #props: CategoriesTreeVisibilityHelperProps;
  #elementClassName: string;
  #modelClassName: string;
  constructor(props: CategoriesTreeVisibilityHelperProps) {
    super(props);
    this.#props = props;
    this.#elementClassName = this.#props.viewport.viewType === "2d" ? CLASS_NAME_GeometricElement2d : CLASS_NAME_GeometricElement3d;
    this.#modelClassName = this.#props.viewport.viewType === "2d" ? CLASS_NAME_GeometricModel2d : CLASS_NAME_GeometricModel3d;
  }

  /**
   * Gets visibility status of definition containers.
   *
   * Determines visibility status by checking visibility status of related categories.
   */
  public getDefinitionContainersVisibilityStatus(props: { definitionContainerIds: Id64Arg }): Observable<VisibilityStatus> {
    return this.#props.idsCache
      .getAllContainedCategories({
        definitionContainerIds: props.definitionContainerIds,
        includeEmptyCategories: this.#props.hierarchyConfig.showEmptyCategories,
      })
      .pipe(
        mergeMap((categoryIds) =>
          this.getCategoriesVisibilityStatus({
            categoryIds,
            modelId: undefined,
            type: this.#props.viewport.viewType === "2d" ? "DrawingCategory" : "SpatialCategory",
          }),
        ),
      );
  }

  public getParentElementsIdsPath({
    parentInstanceKeys,
    modelId,
  }: {
    parentInstanceKeys: Array<Array<InstanceKey>>;
    modelId: Id64String;
  }): Observable<Array<Id64Arg>> {
    // Parent instance keys can have definition containers, categories, models (if they are sub-models) or elements, need to determine which ones are elements.
    return defer(async () => {
      for (let i = 0; i < parentInstanceKeys.length; ++i) {
        const instanceKeys = parentInstanceKeys[i];
        for (const instanceKey of instanceKeys) {
          if (instanceKey.id !== modelId) {
            continue;
          }
          const [isDerivedFrom, isDerivedTo] = await Promise.all([
            this.#props.classInspector.classDerivesFrom(instanceKey.className, this.#modelClassName),
            this.#props.classInspector.classDerivesFrom(this.#modelClassName, instanceKey.className),
          ]);
          if (isDerivedFrom || isDerivedTo) {
            // Found model node, after model category node will be present, so we can skip first two parent keys.
            return parentInstanceKeys.slice(i + 2);
          }
        }
      }
      // In case where model is not found, this means that element is under root category node, so all parent keys are relevant.
      return parentInstanceKeys;
    }).pipe(
      mergeMap(async (parentKeysToCheck) => {
        return (
          await Promise.all(
            parentKeysToCheck.map(async (instanceKeysOfParentNode) => {
              // Only need to check the first instance key class to determine if it's an element.
              // This is because nodes' which have multiple instance keys always share the same class.
              const [isDerivedFrom, isDerivedTo] = await Promise.all([
                this.#props.classInspector.classDerivesFrom(instanceKeysOfParentNode[0].className, CLASS_NAME_GeometricElement3d),
                this.#props.classInspector.classDerivesFrom(CLASS_NAME_GeometricElement3d, instanceKeysOfParentNode[0].className),
              ]);
              if (isDerivedFrom || isDerivedTo) {
                return instanceKeysOfParentNode.map((instanceKey) => instanceKey.id);
              }
              return undefined;
            }),
          )
        ).filter((elementParentKeys) => !!elementParentKeys);
      }),
    );
  }

  /** Gets grouped elements visibility status. */
  public getGroupedElementsVisibilityStatus(props: {
    modelElementsMap: Map<ModelId, { elementIds: Set<ElementId>; categoryOfElementOrParentElementWhichIsNotChild: CategoryId }>;
    categoryId: Id64String;
    parentKeys: HierarchyNodeKey[];
    childrenCount: number;
  }): Observable<VisibilityStatus> {
    const { modelElementsMap, categoryId } = props;
    return from(modelElementsMap).pipe(
      mergeMap(([modelId, { elementIds, categoryOfElementOrParentElementWhichIsNotChild }]) =>
        this.getParentElementsIdsPath({
          modelId,
          parentInstanceKeys: props.parentKeys.filter((key) => HierarchyNodeKey.isInstances(key)).map((key) => key.instanceKeys),
        }).pipe(
          mergeMap((parentElementsIdsPath) =>
            this.getElementsVisibilityStatus({
              elementIds,
              modelId,
              categoryId,
              type: this.#props.viewport.viewType === "2d" ? "GeometricElement2d" : "GeometricElement3d",
              parentElementsIdsPath,
              childrenCount: props.childrenCount,
              categoryOfElementOrParentElementWhichIsNotChild,
            }),
          ),
        ),
      ),
      mergeVisibilityStatuses,
    );
  }

  /**
   * Changes visibility status of definition containers.
   *
   * Does this by changing visibility status of related categories.
   */
  public changeDefinitionContainersVisibilityStatus(props: { definitionContainerIds: Id64Arg; on: boolean }): Observable<void> {
    return this.#props.idsCache
      .getAllContainedCategories({
        definitionContainerIds: props.definitionContainerIds,
        includeEmptyCategories: this.#props.hierarchyConfig.showEmptyCategories,
      })
      .pipe(mergeMap((categoryIds) => this.changeCategoriesVisibilityStatus({ categoryIds, modelId: undefined, on: props.on })));
  }

  /**
   * Changes visibility status of sub-categories.
   *
   * Also, enables parent categories if `on` is true.
   */
  public changeSubCategoriesVisibilityStatus(props: { categoryId: Id64String; subCategoryIds: Id64Arg; on: boolean }): Observable<void> {
    return concat(
      // make sure parent category and models are enabled
      props.on
        ? concat(
            from(enableCategoryDisplay(this.#props.viewport, props.categoryId, props.on, false)),
            this.enableCategoriesElementModelsVisibilityStatus(props.categoryId),
          )
        : EMPTY,
      from(props.subCategoryIds).pipe(map((subCategoryId) => this.#props.viewport.changeSubCategoryDisplay({ subCategoryId, display: props.on }))),
    );
  }

  /** Changes grouped elements visibility status. */
  public changeGroupedElementsVisibilityStatus(props: {
    modelElementsMap: Map<ModelId, { elementIds: Set<ElementId> }>;
    categoryId: Id64String;
    on: boolean;
  }): Observable<void> {
    const elementIds = new Array<ElementId>();
    for (const { elementIds: ids } of props.modelElementsMap.values()) {
      elementIds.push(...ids);
    }
    return this.#props.idsCache.getChildrenTree({ elementIds }).pipe(
      map((childrenTree) => getIdsFromChildrenTree({ tree: childrenTree, predicate: ({ depth }) => depth > 0 })),
      mergeMap((children) =>
        from(props.modelElementsMap).pipe(
          mergeMap(([modelId, { elementIds: modelElementIds }]) => {
            return this.changeElementsVisibilityStatus({ modelId, elementIds: modelElementIds, categoryId: props.categoryId, on: props.on, children });
          }),
        ),
      ),
    );
  }

  /** Turns on visibility status of models (that are not yet turned on) that are related to categories. */
  private enableCategoriesElementModelsVisibilityStatus(categoryIds: Id64Arg): Observable<void> {
    return this.#props.idsCache.getCategoriesElementModels(categoryIds, true).pipe(
      reduce((acc, { models }) => {
        models?.forEach((modelId) => {
          if (!this.#props.viewport.viewsModel(modelId)) {
            acc.add(modelId);
          }
        });
        return acc;
      }, new Set<Id64String>()),
      map((hiddenModels) => {
        if (hiddenModels.size > 0) {
          this.#props.viewport.changeModelDisplay({ modelIds: hiddenModels, display: true });
        }
      }),
    );
  }
}
