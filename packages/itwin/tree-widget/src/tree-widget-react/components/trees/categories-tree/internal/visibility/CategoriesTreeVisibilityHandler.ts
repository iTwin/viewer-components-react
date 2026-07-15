/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { concat, defer, EMPTY, from, merge, mergeAll, mergeMap, of, Subject } from "rxjs";
import { assert, Guid } from "@itwin/core-bentley";
import { createVisibilityStatus } from "../../../common/internal/Tooltip.js";
import { HierarchyVisibilityHandlerImpl } from "../../../common/internal/useTreeHooks/UseCachedVisibility.js";
import { fromWithRelease, getClassesByView } from "../../../common/internal/Utils.js";
import { mergeVisibilityStatuses } from "../../../common/internal/VisibilityUtils.js";
import { CategoriesTreeNodeInternal } from "../../internal/CategoriesTreeNodeInternal.js";
import { CategoriesTreeVisibilityHelper } from "./CategoriesTreeVisibilityHelper.js";
import { createCategoriesSearchResultsTree } from "./SearchResultsTree.js";

import type { Observable } from "rxjs";
import type { HierarchyNode, HierarchySearchTree } from "@itwin/presentation-hierarchies";
import type { ECClassHierarchyInspector } from "@itwin/presentation-shared";
import type { AlwaysAndNeverDrawnElementInfoCache } from "../../../common/internal/caches/AlwaysAndNeverDrawnElementInfoCache.js";
import type { SearchResultsTree } from "../../../common/internal/visibility/BaseSearchResultsTree.js";
import type { TreeSpecificVisibilityHandler } from "../../../common/internal/visibility/BaseVisibilityHelper.js";
import type { TreeWidgetViewport } from "../../../common/TreeWidgetViewport.js";
import type { VisibilityStatus } from "../../../common/UseHierarchyVisibility.js";
import type { CategoriesTreeHierarchyConfiguration } from "../../CategoriesTreeDefinition.js";
import type { CategoriesTreeIdsCache } from "../CategoriesTreeIdsCache.js";
import type { CategoriesTreeSearchTargets } from "./SearchResultsTree.js";

/** @internal */
export interface CategoriesTreeVisibilityHandlerProps {
  idsCache: CategoriesTreeIdsCache;
  viewport: TreeWidgetViewport;
  alwaysAndNeverDrawnElementInfo: AlwaysAndNeverDrawnElementInfoCache;
  hierarchyConfig?: CategoriesTreeHierarchyConfiguration;
}

/**
 * Handles visibility status of categories tree nodes.
 *
 * This handler knows how to get and change visibility status of nodes created by hierarchy definition.
 * @internal
 */
export class CategoriesTreeVisibilityHandler implements Disposable, TreeSpecificVisibilityHandler<CategoriesTreeSearchTargets> {
  readonly #props: CategoriesTreeVisibilityHandlerProps;
  #visibilityHelper: CategoriesTreeVisibilityHelper;
  constructor(constructorProps: CategoriesTreeVisibilityHandlerProps) {
    this.#props = constructorProps;
    this.#visibilityHelper = new CategoriesTreeVisibilityHelper({
      viewport: this.#props.viewport,
      idsCache: this.#props.idsCache,
      alwaysAndNeverDrawnElementInfo: this.#props.alwaysAndNeverDrawnElementInfo,
      baseIdsCache: constructorProps.idsCache,
      hierarchyConfig: constructorProps.hierarchyConfig,
    });
  }

  public [Symbol.dispose]() {
    this.#visibilityHelper[Symbol.dispose]();
  }

  public changeSearchTargetsVisibilityStatus(targets: CategoriesTreeSearchTargets, on: boolean): Observable<void> {
    return defer(() => {
      if (this.#props.viewport.viewType === "other") {
        return EMPTY;
      }
      const { definitionContainerIds, subCategories, categories, elements } = targets;
      const observables = new Array<Observable<void>>();
      if (definitionContainerIds?.size) {
        observables.push(this.#visibilityHelper.changeDefinitionContainersVisibilityStatus({ definitionContainerIds, on }));
      }

      if (categories?.length) {
        observables.push(
          from(categories).pipe(
            mergeMap(({ modelId, categoryIds, parentElementsPath }) =>
              this.#visibilityHelper.changeCategoriesVisibilityStatus({ categoryIds, modelId, on, parentElementsPath }),
            ),
          ),
        );
      }

      if (subCategories?.length) {
        observables.push(
          from(subCategories).pipe(
            mergeMap(({ categoryId, subCategoryIds }) => this.#visibilityHelper.changeSubCategoriesVisibilityStatus({ subCategoryIds, categoryId, on })),
          ),
        );
      }

      if (elements?.length) {
        observables.push(
          fromWithRelease({ source: elements, releaseOnCount: 50 }).pipe(
            mergeMap(({ modelId, nonSearchTargetElements, searchTargetElements, categoryId, parentElementsPath }) => {
              return merge(
                searchTargetElements.length > 0
                  ? this.#visibilityHelper.changeElementsVisibilityStatus({
                      modelId,
                      categoryId,
                      elementIds: searchTargetElements,
                      parentElementsPath,
                      on,
                    })
                  : EMPTY,
                // Child always/never drawn elements will be in search paths, and their visibility status will be handled separately.
                nonSearchTargetElements.length > 0
                  ? this.#visibilityHelper.changeElementsVisibilityStatus({
                      modelId,
                      categoryId,
                      elementIds: nonSearchTargetElements,
                      on,
                      ignoreDescendants: true,
                    })
                  : EMPTY,
              );
            }),
          ),
        );
      }

      return merge(...observables);
    });
  }

  public getVisibilityStatus(node: HierarchyNode): Observable<VisibilityStatus> {
    if (this.#props.viewport.viewType === "other") {
      return of(createVisibilityStatus("disabled"));
    }

    if (CategoriesTreeNodeInternal.isElementClassGroupingNode(node)) {
      return this.#visibilityHelper.getGroupedElementsVisibilityStatus({
        categoryId: node.extendedData.categoryId,
        modelElementsMap: node.extendedData.modelElementsMap,
        parentElementsPath: node.extendedData.parentElementsPath,
      });
    }

    if (CategoriesTreeNodeInternal.isDefinitionContainerNode(node)) {
      return this.#visibilityHelper.getDefinitionContainersVisibilityStatus({
        definitionContainerIds: node.key.instanceKeys.map((instanceKey) => instanceKey.id),
      });
    }

    if (CategoriesTreeNodeInternal.isModelNode(node)) {
      return this.#visibilityHelper.getModelsVisibilityStatus({
        modelIds: node.key.instanceKeys.map((instanceKey) => instanceKey.id),
      });
    }

    if (CategoriesTreeNodeInternal.isCategoryNode(node)) {
      const modelIds = node.extendedData.modelIds.length > 0 ? node.extendedData.modelIds : [undefined];
      const categoryIds = node.key.instanceKeys.map((instanceKey) => instanceKey.id);
      return from(modelIds).pipe(
        mergeMap((modelId) =>
          this.#visibilityHelper.getCategoriesVisibilityStatus({
            categoryIds,
            modelId,
            parentElementsPath: node.extendedData.parentElementsPath,
          }),
        ),
        mergeVisibilityStatuses(),
      );
    }

    if (CategoriesTreeNodeInternal.isSubCategoryNode(node)) {
      return this.#visibilityHelper.getSubCategoriesVisibilityStatus({
        categoryId: node.extendedData.categoryId,
        subCategoryIds: node.key.instanceKeys.map((instanceKey) => instanceKey.id),
      });
    }

    assert(CategoriesTreeNodeInternal.isElementNode(node));
    return this.#visibilityHelper.getElementsVisibilityStatus({
      elementIds: node.key.instanceKeys.map((instanceKey) => instanceKey.id),
      modelId: node.extendedData.modelId,
      categoryId: node.extendedData.categoryId,
      parentElementsPath: node.extendedData.parentElementsPath,
      computeOnlyOwnStatus: this.#props.idsCache.canHaveHiddenChildren() || node.children ? undefined : true,
    });
  }

  /** Changes visibility of the items represented by the tree node. */
  public changeVisibilityStatus(node: HierarchyNode, on: boolean): Observable<void> {
    const changeObs = defer(() => {
      if (this.#props.viewport.viewType === "other") {
        return EMPTY;
      }
      if (CategoriesTreeNodeInternal.isElementClassGroupingNode(node)) {
        return this.#visibilityHelper.changeGroupedElementsVisibilityStatus({
          categoryId: node.extendedData.categoryId,
          modelElementsMap: node.extendedData.modelElementsMap,
          parentElementsPath: node.extendedData.parentElementsPath,
          on,
        });
      }

      if (CategoriesTreeNodeInternal.isDefinitionContainerNode(node)) {
        return this.#visibilityHelper.changeDefinitionContainersVisibilityStatus({
          definitionContainerIds: node.key.instanceKeys.map((instanceKey) => instanceKey.id),
          on,
        });
      }

      if (CategoriesTreeNodeInternal.isModelNode(node)) {
        return this.#visibilityHelper.changeModelsVisibilityStatus({
          modelIds: node.key.instanceKeys.map(({ id }) => id),
          on,
        });
      }

      if (CategoriesTreeNodeInternal.isCategoryNode(node)) {
        const categoryIds = node.key.instanceKeys.map((instanceKey) => instanceKey.id);
        const modelIds = node.extendedData.modelIds.length > 0 ? node.extendedData.modelIds : [undefined];
        return from(modelIds).pipe(
          mergeMap((modelId) =>
            this.#visibilityHelper.changeCategoriesVisibilityStatus({
              categoryIds,
              modelId,
              on,
              parentElementsPath: node.extendedData.parentElementsPath,
            }),
          ),
        );
      }

      if (CategoriesTreeNodeInternal.isSubCategoryNode(node)) {
        return this.#visibilityHelper.changeSubCategoriesVisibilityStatus({
          categoryId: node.extendedData.categoryId,
          subCategoryIds: node.key.instanceKeys.map((instanceKey) => instanceKey.id),
          on,
        });
      }
      assert(CategoriesTreeNodeInternal.isElementNode(node));

      const elementIds = node.key.instanceKeys.map(({ id }) => id);
      return this.#visibilityHelper.changeElementsVisibilityStatus({
        elementIds,
        modelId: node.extendedData.modelId,
        categoryId: node.extendedData.categoryId,
        on,
        parentElementsPath: node.extendedData.parentElementsPath,
      });
    });

    if (this.#props.viewport.isAlwaysDrawnExclusive) {
      return concat(this.#visibilityHelper.removeAlwaysDrawnExclusive(), changeObs);
    }
    return changeObs;
  }

  public getSearchTargetsVisibilityStatus(targets: CategoriesTreeSearchTargets): Observable<VisibilityStatus> {
    if (this.#props.viewport.viewType === "other") {
      return of(createVisibilityStatus("disabled"));
    }
    return defer(() => {
      const { definitionContainerIds, subCategories, categories, elements } = targets;
      const observables = new Array<Observable<VisibilityStatus>>();
      if (definitionContainerIds?.size) {
        observables.push(this.#visibilityHelper.getDefinitionContainersVisibilityStatus({ definitionContainerIds }));
      }

      if (categories?.length) {
        observables.push(
          from(categories).pipe(
            mergeMap(({ modelId, categoryIds, parentElementsPath }) =>
              this.#visibilityHelper.getCategoriesVisibilityStatus({
                categoryIds,
                modelId,
                parentElementsPath,
              }),
            ),
          ),
        );
      }

      if (subCategories?.length) {
        observables.push(
          from(subCategories).pipe(
            mergeMap(({ categoryId, subCategoryIds }) => this.#visibilityHelper.getSubCategoriesVisibilityStatus({ subCategoryIds, categoryId })),
          ),
        );
      }

      if (elements?.length) {
        observables.push(
          fromWithRelease({ source: elements, releaseOnCount: 50 }).pipe(
            mergeMap(({ modelId, searchTargetElements, nonSearchTargetElements, categoryId, parentElementsPath }) => {
              return merge(
                searchTargetElements.length > 0
                  ? this.#visibilityHelper.getElementsVisibilityStatus({
                      modelId,
                      categoryId,
                      elementIds: searchTargetElements,
                      parentElementsPath,
                    })
                  : EMPTY,
                // Child always/never drawn elements will be in search paths, and their visibility status will be handled separately.
                nonSearchTargetElements.length > 0
                  ? this.#visibilityHelper.getElementsVisibilityStatus({
                      modelId,
                      categoryId,
                      elementIds: nonSearchTargetElements,
                      computeOnlyOwnStatus: true,
                    })
                  : EMPTY,
              );
            }),
          ),
        );
      }

      return from(observables).pipe(mergeAll(), mergeVisibilityStatuses());
    });
  }
}

/**
 * Creates categories tree visibility handler. Is used by integration and performance tests.
 * @internal
 */
export function createCategoriesTreeVisibilityHandler(props: {
  viewport: TreeWidgetViewport;
  idsCache: CategoriesTreeIdsCache;
  imodelAccess: ECClassHierarchyInspector;
  searchPaths?: HierarchySearchTree[];
  hierarchyConfig?: CategoriesTreeHierarchyConfiguration;
}) {
  return new HierarchyVisibilityHandlerImpl<CategoriesTreeSearchTargets>({
    cancelChangesInProgress: new Subject<void>(),
    getSearchResultsTree: (): undefined | Promise<SearchResultsTree<CategoriesTreeSearchTargets>> => {
      if (!props.searchPaths) {
        return undefined;
      }
      const { categoryClass, elementClass, modelClass } = getClassesByView(props.viewport.viewType === "2d" ? "2d" : "3d");
      return createCategoriesSearchResultsTree({
        idsCache: props.idsCache,
        searchPaths: props.searchPaths,
        imodelAccess: props.imodelAccess,
        categoryClassName: categoryClass,
        categoryElementClassName: elementClass,
        categoryModelClassName: modelClass,
      });
    },
    getTreeSpecificVisibilityHandler: ({ info, viewport }) => {
      return new CategoriesTreeVisibilityHandler({
        alwaysAndNeverDrawnElementInfo: info,
        idsCache: props.idsCache,
        viewport,
        hierarchyConfig: props.hierarchyConfig,
      });
    },
    viewport: props.viewport,
    componentId: Guid.createValue(),
  });
}
