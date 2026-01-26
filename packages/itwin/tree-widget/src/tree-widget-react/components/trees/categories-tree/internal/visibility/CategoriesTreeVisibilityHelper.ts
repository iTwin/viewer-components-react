/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { concat, EMPTY, from, map, mergeMap, toArray } from "rxjs";
import { HierarchyNodeKey } from "@itwin/presentation-hierarchies";
import { getIdsFromChildrenTree, getParentElementsIdsPath } from "../../../common/internal/Utils.js";
import { BaseVisibilityHelper } from "../../../common/internal/visibility/BaseVisibilityHelper.js";
import { mergeVisibilityStatuses } from "../../../common/internal/VisibilityUtils.js";

import type { Observable } from "rxjs";
import type { Id64Arg, Id64String } from "@itwin/core-bentley";
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
  constructor(props: CategoriesTreeVisibilityHelperProps) {
    super(props);
    this.#props = props;
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

  /** Gets grouped elements visibility status. */
  public getGroupedElementsVisibilityStatus(props: {
    modelElementsMap: Map<ModelId, { elementIds: Set<ElementId>; categoryOfTopMostParentElement: CategoryId }>;
    categoryId: Id64String;
    parentKeys: HierarchyNodeKey[];
    childrenCount: number;
    topMostParentElementId?: ElementId;
  }): Observable<VisibilityStatus> {
    const { modelElementsMap, categoryId, topMostParentElementId } = props;
    return from(modelElementsMap).pipe(
      mergeMap(([modelId, { elementIds, categoryOfTopMostParentElement }]) =>
        this.getElementsVisibilityStatus({
          elementIds,
          modelId,
          categoryId,
          type: this.#props.viewport.viewType === "2d" ? "GeometricElement2d" : "GeometricElement3d",
          parentElementsIdsPath: topMostParentElementId
            ? getParentElementsIdsPath({
                parentInstanceKeys: props.parentKeys.filter((key) => HierarchyNodeKey.isInstances(key)).map((key) => key.instanceKeys),
                topMostParentElementId,
              })
            : [],
          childrenCount: props.childrenCount,
          categoryOfTopMostParentElement,
        }),
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
      props.on ? this.enableCategoryWithoutEnablingOtherCategories(props.categoryId) : EMPTY,
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
      ids.forEach((id) => elementIds.push(id));
    }
    return this.#props.idsCache.getChildElementsTree({ elementIds }).pipe(
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

  /** Turns on category and its' related models. Does not turn on other categories contained in those models.*/
  private enableCategoryWithoutEnablingOtherCategories(categoryId: Id64String): Observable<void> {
    this.#props.viewport.changeCategoryDisplay({ categoryIds: categoryId, display: true });
    return this.#props.idsCache.getCategoriesElementModels(categoryId, true).pipe(
      mergeMap(({ models }) => from(models ?? [])),
      mergeMap((modelId) => {
        this.#props.viewport.setPerModelCategoryOverride({ modelIds: modelId, categoryIds: categoryId, override: "none" });
        return this.#props.viewport.viewsModel(modelId)
          ? EMPTY
          : this.#props.idsCache.getCategoriesOfElementModel(modelId).pipe(
              map((allModelCategories) => {
                // Add 'Hide' override to categories that were hidden before model is turned on
                allModelCategories?.forEach((modelCategoryId) => {
                  if (modelCategoryId !== categoryId) {
                    this.#props.viewport.setPerModelCategoryOverride({ modelIds: modelId, categoryIds: modelCategoryId, override: "hide" });
                  }
                });
                return modelId;
              }),
            );
      }),
      toArray(),
      map((hiddenModels) => {
        if (hiddenModels.length > 0) {
          this.#props.viewport.changeModelDisplay({ modelIds: hiddenModels, display: true });
        }
      }),
    );
  }
}
