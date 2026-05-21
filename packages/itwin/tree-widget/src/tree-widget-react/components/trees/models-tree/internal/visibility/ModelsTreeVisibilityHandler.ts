/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { concat, defer, EMPTY, from, merge, mergeAll, mergeMap, of, Subject } from "rxjs";
import { assert, Guid } from "@itwin/core-bentley";
import { HierarchyNodeKey } from "@itwin/presentation-hierarchies";
import { createVisibilityStatus } from "../../../common/internal/Tooltip.js";
import { HierarchyVisibilityHandlerImpl } from "../../../common/internal/useTreeHooks/UseCachedVisibility.js";
import { fromWithRelease, getParentElementsIdsPath } from "../../../common/internal/Utils.js";
import { mergeVisibilityStatuses } from "../../../common/internal/VisibilityUtils.js";
import { ModelsTreeNodeInternal } from "../ModelsTreeNodeInternal.js";
import { ModelsTreeVisibilityHelper } from "./ModelsTreeVisibilityHelper.js";
import { createModelsSearchResultsTree } from "./SearchResultsTree.js";

import type { Observable } from "rxjs";
import type { Id64Arg, Id64String } from "@itwin/core-bentley";
import type { GroupingHierarchyNode, HierarchyNode, HierarchySearchTree } from "@itwin/presentation-hierarchies";
import type { ECClassHierarchyInspector } from "@itwin/presentation-shared";
import type { AlwaysAndNeverDrawnElementInfoCache } from "../../../common/internal/caches/AlwaysAndNeverDrawnElementInfoCache.js";
import type { SearchResultsTree } from "../../../common/internal/visibility/BaseSearchResultsTree.js";
import type { BaseTreeVisibilityHandlerOverrides, TreeSpecificVisibilityHandler } from "../../../common/internal/visibility/BaseVisibilityHelper.js";
import type { TreeWidgetViewport } from "../../../common/TreeWidgetViewport.js";
import type {
  HierarchyVisibilityHandlerOverridableMethod,
  HierarchyVisibilityOverrideHandler,
  VisibilityStatus,
} from "../../../common/UseHierarchyVisibility.js";
import type { ModelsTreeIdsCache } from "../ModelsTreeIdsCache.js";
import type { ModelsTreeSearchTargets } from "./SearchResultsTree.js";

/**
 * Functionality of Models tree visibility handler that can be overridden.
 * Each callback is provided original implementation and reference to a `HierarchyVisibilityHandler`.
 * @beta
 */
export interface ModelsTreeVisibilityHandlerOverrides extends BaseTreeVisibilityHandlerOverrides {
  getSubjectsVisibilityStatus?: HierarchyVisibilityHandlerOverridableMethod<(props: { subjectIds: Id64Arg }) => Promise<VisibilityStatus>>;
  getElementGroupingNodeVisibilityStatus?: HierarchyVisibilityHandlerOverridableMethod<(props: { node: GroupingHierarchyNode }) => Promise<VisibilityStatus>>;

  changeSubjectsVisibilityStatus?: HierarchyVisibilityHandlerOverridableMethod<(props: { subjectIds: Id64Arg; on: boolean }) => Promise<void>>;
  changeElementGroupingNodeVisibilityStatus?: HierarchyVisibilityHandlerOverridableMethod<
    (props: { node: GroupingHierarchyNode; on: boolean }) => Promise<void>
  >;
}

/** @internal */
export interface ModelsTreeVisibilityHandlerProps {
  idsCache: ModelsTreeIdsCache;
  viewport: TreeWidgetViewport;
  alwaysAndNeverDrawnElementInfo: AlwaysAndNeverDrawnElementInfoCache;
  overrideHandler: HierarchyVisibilityOverrideHandler;
  overrides?: ModelsTreeVisibilityHandlerOverrides;
}

/**
 * Handles visibility status of models tree nodes.
 *
 * It knows how to get and change visibility status of nodes created by hierarchy definition.
 * @internal
 */
export class ModelsTreeVisibilityHandler implements Disposable, TreeSpecificVisibilityHandler<ModelsTreeSearchTargets> {
  #visibilityHelper: ModelsTreeVisibilityHelper;
  readonly #props: ModelsTreeVisibilityHandlerProps;

  constructor(constructorProps: ModelsTreeVisibilityHandlerProps) {
    this.#props = constructorProps;
    this.#visibilityHelper = new ModelsTreeVisibilityHelper({
      viewport: this.#props.viewport,
      idsCache: this.#props.idsCache,
      alwaysAndNeverDrawnElementInfo: this.#props.alwaysAndNeverDrawnElementInfo,
      overrideHandler: this.#props.overrideHandler,
      baseIdsCache: this.#props.idsCache,
      overrides: this.#props.overrides,
    });
  }

  public [Symbol.dispose]() {
    this.#visibilityHelper[Symbol.dispose]();
  }

  public changeSearchTargetsVisibilityStatus(targets: ModelsTreeSearchTargets, on: boolean): Observable<void> {
    return defer(() => {
      const { subjectIds, modelIds, categories, elements } = targets;
      const observables = new Array<Observable<void>>();
      if (this.#props.viewport.viewType !== "3d") {
        return EMPTY;
      }
      if (subjectIds?.size) {
        observables.push(this.#visibilityHelper.changeSubjectsVisibilityStatus({ subjectIds, on }));
      }

      if (modelIds?.size) {
        observables.push(this.#visibilityHelper.changeModelsVisibilityStatus({ modelIds, on }));
      }

      if (categories?.length) {
        observables.push(
          from(categories).pipe(
            mergeMap(({ modelId, categoryIds }) =>
              this.#visibilityHelper.changeCategoriesVisibilityStatus({
                categoryIds,
                modelId,
                on,
              }),
            ),
          ),
        );
      }

      if (elements?.length) {
        observables.push(
          fromWithRelease({ source: elements, releaseOnCount: 50 }).pipe(
            mergeMap(({ modelId, elements: elementsMap, categoryId, pathToElements, topMostParentElementId }) => {
              const parentElementsIdsPath = topMostParentElementId
                ? getParentElementsIdsPath({
                    parentInstanceKeys: pathToElements.map((instanceKey) => [instanceKey]),
                    topMostParentElementId,
                  })
                : [];
              const nonSearchTargetIds = new Array<Id64String>();
              const searchTargetIds = new Array<Id64String>();
              for (const [elementId, { isSearchTarget }] of elementsMap) {
                if (!isSearchTarget) {
                  nonSearchTargetIds.push(elementId);
                  continue;
                }
                searchTargetIds.push(elementId);
              }
              return merge(
                searchTargetIds.length > 0
                  ? this.#visibilityHelper.changeElementsVisibilityStatus({
                      modelId,
                      categoryId,
                      elementIds: searchTargetIds,
                      parentElementsIdsPath,
                      // Search results tree is created on search paths. Since search paths contain only categories that are directly under models
                      // or at the root, categoryId can be used here.
                      categoryOfTopMostParentElement: categoryId,
                      on,
                    })
                  : EMPTY,
                // Child always/never drawn elements will be in search paths, and their visibility status will be handled separately.
                nonSearchTargetIds.length > 0
                  ? this.#visibilityHelper.changeElementsVisibilityStatus({
                      modelId,
                      categoryId,
                      elementIds: nonSearchTargetIds,
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
    if (this.#props.viewport.viewType !== "3d") {
      return of(createVisibilityStatus("disabled"));
    }

    if (ModelsTreeNodeInternal.isElementClassGroupingNode(node)) {
      const result = this.#visibilityHelper.getGroupedElementsVisibilityStatus({
        categoryId: node.extendedData.categoryId,
        modelId: node.extendedData.modelId,
        elementIds: node.groupedInstanceKeys.map((key) => key.id),
        parentKeys: node.parentKeys,
        categoryOfTopMostParentElement: node.extendedData.categoryOfTopMostParentElement,
        topMostParentElementId: node.extendedData.topMostParentElementId,
      });
      return this.#props.overrideHandler.createVisibilityHandlerResult({
        overrideProps: { node },
        nonOverriddenResult: result,
        override: this.#props.overrides?.getElementGroupingNodeVisibilityStatus,
      });
    }

    if (ModelsTreeNodeInternal.isSubjectNode(node)) {
      // note: subject nodes may be merged to represent multiple subject instances
      return this.#visibilityHelper.getSubjectsVisibilityStatus({ subjectIds: node.key.instanceKeys.map((key) => key.id) });
    }

    if (ModelsTreeNodeInternal.isModelNode(node)) {
      return this.#visibilityHelper.getModelsVisibilityStatus({ modelIds: node.key.instanceKeys.map(({ id }) => id) });
    }

    if (ModelsTreeNodeInternal.isCategoryNode(node)) {
      return this.#visibilityHelper.getCategoriesVisibilityStatus({
        categoryIds: node.key.instanceKeys.map(({ id }) => id),
        modelId: node.extendedData.modelIds[0],
      });
    }

    assert(ModelsTreeNodeInternal.isElementNode(node));
    const parentElementsIdsPath = getParentElementsIdsPath({
      parentInstanceKeys: node.parentKeys.filter((key) => HierarchyNodeKey.isInstances(key)).map((key) => key.instanceKeys),
      topMostParentElementId: node.extendedData.topMostParentElementId,
    });
    return this.#visibilityHelper.getElementsVisibilityStatus({
      elementIds: node.key.instanceKeys.map(({ id }) => id),
      modelId: node.extendedData.modelId,
      categoryId: node.extendedData.categoryId,
      parentElementsIdsPath,
      categoryOfTopMostParentElement: node.extendedData.categoryOfTopMostParentElement,
    });
  }

  /** Changes visibility of the items represented by the tree node. */
  public changeVisibilityStatus(node: HierarchyNode, on: boolean): Observable<void> {
    const changeObs = defer(() => {
      if (this.#props.viewport.viewType !== "3d") {
        return EMPTY;
      }
      if (ModelsTreeNodeInternal.isElementClassGroupingNode(node)) {
        const result = this.#visibilityHelper.changeGroupedElementsVisibilityStatus({
          categoryId: node.extendedData.categoryId,
          modelId: node.extendedData.modelId,
          elementIds: node.groupedInstanceKeys.map((key) => key.id),
          on,
          parentKeys: node.parentKeys,
          categoryOfTopMostParentElement: node.extendedData.categoryOfTopMostParentElement,
          topMostParentElementId: node.extendedData.topMostParentElementId,
        });
        return this.#props.overrideHandler.createVisibilityHandlerResult({
          overrideProps: { node, on },
          nonOverriddenResult: result,
          override: this.#props.overrides?.changeElementGroupingNodeVisibilityStatus,
        });
      }

      if (ModelsTreeNodeInternal.isSubjectNode(node)) {
        return this.#visibilityHelper.changeSubjectsVisibilityStatus({
          subjectIds: node.key.instanceKeys.map((key) => key.id),
          on,
        });
      }

      if (ModelsTreeNodeInternal.isModelNode(node)) {
        return this.#visibilityHelper.changeModelsVisibilityStatus({ modelIds: node.key.instanceKeys.map(({ id }) => id), on });
      }

      if (ModelsTreeNodeInternal.isCategoryNode(node)) {
        return this.#visibilityHelper.changeCategoriesVisibilityStatus({
          categoryIds: node.key.instanceKeys.map(({ id }) => id),
          modelId: node.extendedData.modelIds[0],
          on,
        });
      }

      assert(ModelsTreeNodeInternal.isElementNode(node));
      const elementIds = node.key.instanceKeys.map(({ id }) => id);
      const parentElementsIdsPath = getParentElementsIdsPath({
        parentInstanceKeys: node.parentKeys.filter((key) => HierarchyNodeKey.isInstances(key)).map((key) => key.instanceKeys),
        topMostParentElementId: node.extendedData.topMostParentElementId,
      });

      return this.#visibilityHelper.changeElementsVisibilityStatus({
        elementIds,
        modelId: node.extendedData.modelId,
        categoryId: node.extendedData.categoryId,
        on,
        categoryOfTopMostParentElement: node.extendedData.categoryOfTopMostParentElement,
        parentElementsIdsPath,
      });
    });

    if (this.#props.viewport.isAlwaysDrawnExclusive) {
      return concat(this.#visibilityHelper.removeAlwaysDrawnExclusive(), changeObs);
    }
    return changeObs;
  }

  public getSearchTargetsVisibilityStatus(targets: ModelsTreeSearchTargets): Observable<VisibilityStatus> {
    if (this.#props.viewport.viewType !== "3d") {
      return of(createVisibilityStatus("disabled"));
    }
    return defer(() => {
      const { subjectIds, modelIds, categories, elements } = targets;
      const observables = new Array<Observable<VisibilityStatus>>();
      if (subjectIds?.size) {
        observables.push(this.#visibilityHelper.getSubjectsVisibilityStatus({ subjectIds }));
      }

      if (modelIds?.size) {
        observables.push(this.#visibilityHelper.getModelsVisibilityStatus({ modelIds }));
      }

      if (categories?.length) {
        observables.push(
          from(categories).pipe(
            mergeMap(({ modelId, categoryIds }) =>
              this.#visibilityHelper.getCategoriesVisibilityStatus({
                categoryIds,
                modelId,
              }),
            ),
          ),
        );
      }

      if (elements?.length) {
        observables.push(
          fromWithRelease({ source: elements, releaseOnCount: 50 }).pipe(
            mergeMap(({ modelId, elements: elementsMap, categoryId, pathToElements, topMostParentElementId }) => {
              const parentElementsIdsPath = topMostParentElementId
                ? getParentElementsIdsPath({
                    parentInstanceKeys: pathToElements.map((instanceKey) => [instanceKey]),
                    topMostParentElementId,
                  })
                : [];
              const nonSearchTargetIds = new Array<Id64String>();
              const searchTargetIds = new Array<Id64String>();
              for (const [elementId, { isSearchTarget }] of elementsMap) {
                if (!isSearchTarget) {
                  nonSearchTargetIds.push(elementId);
                  continue;
                }
                searchTargetIds.push(elementId);
              }
              return merge(
                searchTargetIds.length > 0
                  ? this.#visibilityHelper.getElementsVisibilityStatus({
                      modelId,
                      categoryId,
                      elementIds: searchTargetIds,
                      parentElementsIdsPath,
                      // Search results tree is created on search paths. Since search paths contain only categories that are directly under models
                      // or at the root, categoryId can be used here.
                      categoryOfTopMostParentElement: categoryId,
                    })
                  : EMPTY,
                // Child always/never drawn elements will be in search paths, and their visibility status will be handled separately.
                nonSearchTargetIds.length > 0
                  ? this.#visibilityHelper.getElementsVisibilityStatus({
                      modelId,
                      categoryId,
                      elementIds: nonSearchTargetIds,
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
 * Creates models tree visibility handler. Is used by integration and performance tests.
 * @internal
 */
export function createModelsTreeVisibilityHandler(props: {
  viewport: TreeWidgetViewport;
  idsCache: ModelsTreeIdsCache;
  imodelAccess: ECClassHierarchyInspector;
  overrides?: ModelsTreeVisibilityHandlerOverrides;
  searchPaths?: HierarchySearchTree[];
}) {
  return new HierarchyVisibilityHandlerImpl<ModelsTreeSearchTargets>({
    cancelChangesInProgress: new Subject<void>(),
    getSearchResultsTree: (): undefined | Promise<SearchResultsTree<ModelsTreeSearchTargets>> => {
      if (!props.searchPaths) {
        return undefined;
      }
      return createModelsSearchResultsTree({
        searchPaths: props.searchPaths,
        imodelAccess: props.imodelAccess,
      });
    },
    getTreeSpecificVisibilityHandler: ({ info, overrideHandler, viewport }) => {
      return new ModelsTreeVisibilityHandler({
        alwaysAndNeverDrawnElementInfo: info,
        idsCache: props.idsCache,
        viewport,
        overrideHandler,
        overrides: props.overrides,
      });
    },
    viewport: props.viewport,
    componentId: Guid.createValue(),
  });
}
