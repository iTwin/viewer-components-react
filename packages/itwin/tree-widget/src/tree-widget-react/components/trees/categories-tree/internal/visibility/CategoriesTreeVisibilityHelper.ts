/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { bufferCount, concat, concatMap, delay, EMPTY, from, map, merge, mergeMap, reduce, toArray } from "rxjs";
import { createVisibilityStatus } from "../../../common/internal/Tooltip.js";
import { getOptimalBatchSize } from "../../../common/internal/Utils.js";
import { BaseVisibilityHelper } from "../../../common/internal/visibility/BaseVisibilityHelper.js";
import { mergeVisibilityStatuses } from "../../../common/internal/VisibilityUtils.js";

import type { Observable } from "rxjs";
import type { Id64Arg, Id64String } from "@itwin/core-bentley";
import type { BaseVisibilityHelperProps } from "../../../common/internal/visibility/BaseVisibilityHelper.js";
import type { VisibilityStatus } from "../../../common/UseHierarchyVisibility.js";
import type { CategoriesTreeHierarchyConfiguration } from "../../CategoriesTreeDefinition.js";
import type { CategoriesTreeIdsCache } from "../CategoriesTreeIdsCache.js";
import type { ElementClassGroupingNodeProps } from "../CategoriesTreeNodeInternal.js";

/** @internal */
export type CategoriesTreeVisibilityHelperProps = BaseVisibilityHelperProps & {
  idsCache: CategoriesTreeIdsCache;
  hierarchyConfig: CategoriesTreeHierarchyConfiguration;
};

/**
 * Visibility status helper for categories tree.
 *
 * It extends base visibility status helper and provides methods to get and change visibility status of definition containers and grouped elements.
 * @internal
 */
export class CategoriesTreeVisibilityHelper extends BaseVisibilityHelper {
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
    return this.getGroupedContainedCategories(props.definitionContainerIds).pipe(
      mergeMap(({ emptyCategories, topMostElementCategories }) => {
        return merge(
          from(emptyCategories).pipe(
            map((id) => (this.#props.viewport.viewsCategory(id) ? createVisibilityStatus("visible") : createVisibilityStatus("hidden"))),
          ),
          topMostElementCategories.length < 1001
            ? this.getCategoriesVisibilityStatus({ categoryIds: topMostElementCategories, modelId: undefined })
            : from(topMostElementCategories).pipe(
                bufferCount(getOptimalBatchSize({ totalSize: topMostElementCategories.length, maximumBatchSize: 1001 })),
                concatMap((categoryIdsBatch) => this.getCategoriesVisibilityStatus({ categoryIds: categoryIdsBatch, modelId: undefined }).pipe(delay(0))),
              ),
        );
      }),
      mergeVisibilityStatuses(),
    );
  }

  /** Gets grouped elements visibility status. */
  public getGroupedElementsVisibilityStatus(props: {
    modelElementsMap: ElementClassGroupingNodeProps["modelElementsMap"];
    categoryId: Id64String;
    parentElementsPath: ElementClassGroupingNodeProps["parentElementsPath"];
  }): Observable<VisibilityStatus> {
    const { modelElementsMap, categoryId, parentElementsPath } = props;
    return from(modelElementsMap).pipe(
      mergeMap(([modelId, { elementIds, childrenWhichAreParents }]) =>
        this.getElementsVisibilityStatus({
          elementIds,
          modelId,
          categoryId,
          parentElementsPath,
          computeOnlyOwnStatus: this.#props.baseIdsCache.canHaveHiddenChildren()
            ? undefined
            : childrenWhichAreParents.size
              ? (elementId) => !childrenWhichAreParents.has(elementId)
              : true,
        }),
      ),
      mergeVisibilityStatuses(),
    );
  }

  /**
   * Changes visibility status of definition containers.
   *
   * Does this by changing visibility status of related categories.
   */
  public changeDefinitionContainersVisibilityStatus(props: { definitionContainerIds: Id64Arg; on: boolean }): Observable<void> {
    return this.getGroupedContainedCategories(props.definitionContainerIds).pipe(
      mergeMap(({ emptyCategories, topMostElementCategories }) => {
        if (emptyCategories.length > 0) {
          this.#props.viewport.changeCategoryDisplay({ categoryIds: emptyCategories, display: props.on });
        }
        return this.changeCategoriesVisibilityStatus({ categoryIds: topMostElementCategories, modelId: undefined, on: props.on });
      }),
    );
  }

  /**
   * Changes visibility status of sub-categories.
   *
   * Also, enables parent categories if `on` is true.
   */
  public changeSubCategoriesVisibilityStatus(props: { categoryId: Id64String; subCategoryIds: Id64Arg; on: boolean }): Observable<void> {
    return concat(
      // make sure parent category and models are enabled
      props.on ? this.enableCategoryWithoutEnablingOtherCategories({ categoryId: props.categoryId }) : EMPTY,
      from(props.subCategoryIds).pipe(map((subCategoryId) => this.#props.viewport.changeSubCategoryDisplay({ subCategoryId, display: props.on }))),
    );
  }

  /** Changes grouped elements visibility status. */
  public changeGroupedElementsVisibilityStatus(props: {
    modelElementsMap: ElementClassGroupingNodeProps["modelElementsMap"];
    categoryId: Id64String;
    parentElementsPath: ElementClassGroupingNodeProps["parentElementsPath"];
    on: boolean;
  }): Observable<void> {
    const { modelElementsMap, categoryId, parentElementsPath, on } = props;
    return from(modelElementsMap).pipe(
      mergeMap(([modelId, { elementIds }]) => {
        return this.changeElementsVisibilityStatus({
          modelId,
          elementIds,
          categoryId,
          on,
          parentElementsPath,
        });
      }),
    );
  }

  /** Gets categories contained in the given definition containers, split into empty and top most element categories. */
  private getGroupedContainedCategories(
    definitionContainerIds: Id64Arg,
  ): Observable<{ emptyCategories: Id64String[]; topMostElementCategories: Id64String[] }> {
    return this.#props.idsCache.getAllContainedCategories({ definitionContainerIds }).pipe(
      reduce(
        (acc, { id, hasElements, isTopMostElementCategory }) => {
          if (isTopMostElementCategory) {
            acc.topMostElementCategories.push(id);
            return acc;
          }
          if (this.#props.hierarchyConfig.showEmptyCategories && !hasElements) {
            acc.emptyCategories.push(id);
          }
          return acc;
        },
        { emptyCategories: new Array<Id64String>(), topMostElementCategories: new Array<Id64String>() },
      ),
    );
  }

  /** Turns on category and its' related models. Does not turn on other categories contained in those models.*/
  private enableCategoryWithoutEnablingOtherCategories({ categoryId }: { categoryId: Id64String }): Observable<void> {
    this.#props.viewport.changeCategoryDisplay({ categoryIds: categoryId, display: true });
    return this.#props.idsCache.getModels({ categoryId }).pipe(
      mergeMap((modelId) => {
        this.#props.viewport.setPerModelCategoryOverride({ modelIds: modelId, categoryIds: categoryId, override: "none" });
        return this.#props.viewport.viewsModel(modelId)
          ? EMPTY
          : this.#props.idsCache.getCategories({ modelId }).pipe(
              map((allModelCategories) => {
                // Add 'Hide' override to categories that were hidden before model is turned on
                for (const modelCategoryId of allModelCategories) {
                  if (modelCategoryId !== categoryId) {
                    this.#props.viewport.setPerModelCategoryOverride({ modelIds: modelId, categoryIds: modelCategoryId, override: "hide" });
                  }
                }
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
