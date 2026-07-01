/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { concat, defer, EMPTY, from, merge, mergeAll, mergeMap, of, Subject } from "rxjs";
import { assert, Guid } from "@itwin/core-bentley";
import { createVisibilityStatus } from "../../../common/internal/Tooltip.js";
import { HierarchyVisibilityHandlerImpl } from "../../../common/internal/useTreeHooks/UseCachedVisibility.js";
import { fromWithRelease } from "../../../common/internal/Utils.js";
import { mergeVisibilityStatuses } from "../../../common/internal/VisibilityUtils.js";
import { ModelsTreeNodeInternal } from "../ModelsTreeNodeInternal.js";
import { ModelsTreeVisibilityHelper } from "./ModelsTreeVisibilityHelper.js";
import { createModelsSearchResultsTree } from "./SearchResultsTree.js";

import type { Observable } from "rxjs";
import type { Id64Arg } from "@itwin/core-bentley";
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
            mergeMap(({ modelId, categoryIds, parentElementsPath }) =>
              this.#visibilityHelper.changeCategoriesVisibilityStatus({
                categoryIds,
                modelId,
                on,
                parentElementsPath,
              }),
            ),
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
    if (this.#props.viewport.viewType !== "3d") {
      return of(createVisibilityStatus("disabled"));
    }

    if (ModelsTreeNodeInternal.isElementClassGroupingNode(node)) {
      const result = this.#visibilityHelper.getGroupedElementsVisibilityStatus({
        categoryId: node.extendedData.categoryId,
        modelId: node.extendedData.modelId,
        elementIds: node.groupedInstanceKeys.map((key) => key.id),
        parentElementsPath: node.extendedData.parentElementsPath,
        childrenWhichAreParents: node.extendedData.childrenWhichAreParents,
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
      const categoryIds = node.key.instanceKeys.map(({ id }) => id);
      const modelIds = node.extendedData.modelIds.length > 0 ? node.extendedData.modelIds : [undefined];
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

    assert(ModelsTreeNodeInternal.isElementNode(node));
    return this.#visibilityHelper.getElementsVisibilityStatus({
      elementIds: node.key.instanceKeys.map(({ id }) => id),
      modelId: node.extendedData.modelId,
      categoryId: node.extendedData.categoryId,
      parentElementsPath: node.extendedData.parentElementsPath,
      computeOnlyOwnStatus: this.#props.idsCache.canHaveHiddenChildren() ? undefined : node.children ? undefined : true,
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
          parentElementsPath: node.extendedData.parentElementsPath,
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
        const categoryIds = node.key.instanceKeys.map(({ id }) => id);
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

      assert(ModelsTreeNodeInternal.isElementNode(node));
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
        idsCache: props.idsCache,
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
