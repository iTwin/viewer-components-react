/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { concat, defer, EMPTY, from, merge, mergeMap, of } from "rxjs";
import { assert } from "@itwin/core-bentley";
import { HierarchyNode } from "@itwin/presentation-hierarchies";
import { createVisibilityStatus } from "../../../common/internal/Tooltip.js";
import { HierarchyVisibilityHandlerImpl } from "../../../common/internal/useTreeHooks/UseCachedVisibility.js";
import { releaseMainThreadOnItemsCount } from "../../../common/internal/Utils.js";
import { mergeVisibilityStatuses } from "../../../common/internal/VisibilityUtils.js";
import { ModelsTreeNode } from "../ModelsTreeNode.js";
import { createFilteredModelsTree } from "./FilteredTree.js";
import { ModelsTreeVisibilityHelper } from "./ModelsTreeVisibilityHelper.js";

import type { Observable } from "rxjs";
import type { Id64Arg } from "@itwin/core-bentley";
import type { GroupingHierarchyNode, HierarchyFilteringPath } from "@itwin/presentation-hierarchies";
import type { ECClassHierarchyInspector } from "@itwin/presentation-shared";
import type { AlwaysAndNeverDrawnElementInfo } from "../../../common/internal/AlwaysAndNeverDrawnElementInfo.js";
import type { FilteredTree } from "../../../common/internal/visibility/BaseFilteredTree.js";
import type { BaseTreeVisibilityHandlerOverrides, TreeSpecificVisibilityHandler } from "../../../common/internal/visibility/BaseVisibilityHelper.js";
import type { TreeWidgetViewport } from "../../../common/TreeWidgetViewport.js";
import type {
  HierarchyVisibilityHandlerOverridableMethod,
  HierarchyVisibilityOverrideHandler,
  VisibilityStatus,
} from "../../../common/UseHierarchyVisibility.js";
import type { ModelsTreeIdsCache } from "../ModelsTreeIdsCache.js";
import type { ModelsTreeFilterTargets } from "./FilteredTree.js";

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
  alwaysAndNeverDrawnElementInfo: AlwaysAndNeverDrawnElementInfo;
  overrideHandler: HierarchyVisibilityOverrideHandler;
  overrides?: ModelsTreeVisibilityHandlerOverrides;
}

/**
 * Handles visibility status of models tree nodes.
 *
 * It knows how to get and change visibility status of nodes created by hierarchy definition.
 * @internal
 */
export class ModelsTreeVisibilityHandler implements Disposable, TreeSpecificVisibilityHandler<ModelsTreeFilterTargets> {
  #visibilityHelper: ModelsTreeVisibilityHelper;
  readonly #props: ModelsTreeVisibilityHandlerProps;

  constructor(constructorProps: ModelsTreeVisibilityHandlerProps) {
    this.#props = constructorProps;
    this.#visibilityHelper = new ModelsTreeVisibilityHelper({
      viewport: this.#props.viewport,
      idsCache: this.#props.idsCache,
      alwaysAndNeverDrawnElementInfo: this.#props.alwaysAndNeverDrawnElementInfo,
      overrideHandler: this.#props.overrideHandler,
      overrides: this.#props.overrides,
    });
  }

  public [Symbol.dispose]() {
    this.#visibilityHelper[Symbol.dispose]();
  }

  public changeFilterTargetsVisibilityStatus(targets: ModelsTreeFilterTargets, on: boolean): Observable<void> {
    return defer(() => {
      const { subjectIds, modelIds, categories, elements } = targets;
      const observables = new Array<Observable<void>>();
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
          from(elements).pipe(
            releaseMainThreadOnItemsCount(50),
            mergeMap(({ modelId, elementIds, categoryId }) => this.#visibilityHelper.changeElementsVisibilityStatus({ modelId, categoryId, elementIds, on })),
          ),
        );
      }

      return merge(...observables);
    });
  }

  public getVisibilityStatus(node: HierarchyNode): Observable<VisibilityStatus> {
    if (HierarchyNode.isClassGroupingNode(node)) {
      const nodeInfo = this.getGroupingNodeInfo(node);
      const result = this.#visibilityHelper.getGroupedElementsVisibilityStatus({
        categoryId: nodeInfo.categoryId,
        modelId: nodeInfo.modelId,
        elementIds: nodeInfo.elementIds,
      });
      return this.#props.overrideHandler.createVisibilityHandlerResult({
        overrideProps: { node },
        nonOverriddenResult: result,
        override: this.#props.overrides?.getElementGroupingNodeVisibilityStatus,
      });
    }

    if (!HierarchyNode.isInstancesNode(node)) {
      return of(createVisibilityStatus("disabled"));
    }

    if (ModelsTreeNode.isSubjectNode(node)) {
      // note: subject nodes may be merged to represent multiple subject instances
      return this.#visibilityHelper.getSubjectsVisibilityStatus({ subjectIds: node.key.instanceKeys.map((key) => key.id) });
    }

    if (ModelsTreeNode.isModelNode(node)) {
      return this.#visibilityHelper.getModelsVisibilityStatus({ modelIds: node.key.instanceKeys.map(({ id }) => id), type: "GeometricModel3d" });
    }

    const modelId = ModelsTreeNode.getModelId(node);
    if (!modelId) {
      return of(createVisibilityStatus("disabled"));
    }

    if (ModelsTreeNode.isCategoryNode(node)) {
      return this.#visibilityHelper.getCategoriesVisibilityStatus({
        categoryIds: node.key.instanceKeys.map(({ id }) => id),
        modelId,
        type: "SpatialCategory",
        checkSubCategories: false,
      });
    }

    const categoryId = ModelsTreeNode.getCategoryId(node);
    if (!categoryId) {
      return of(createVisibilityStatus("disabled"));
    }

    return this.#visibilityHelper.getElementsVisibilityStatus({
      elementIds: node.key.instanceKeys.map(({ id }) => id),
      modelId,
      categoryId,
      type: "GeometricElement3d",
    });
  }

  /** Changes visibility of the items represented by the tree node. */
  public changeVisibilityStatus(node: HierarchyNode, on: boolean): Observable<void> {
    const changeObs = defer(() => {
      if (HierarchyNode.isClassGroupingNode(node)) {
        const nodeInfo = this.getGroupingNodeInfo(node);
        const result = this.#visibilityHelper.changeGroupedElementsVisibilityStatus({
          categoryId: nodeInfo.categoryId,
          modelId: nodeInfo.modelId,
          elementIds: nodeInfo.elementIds,
          on,
        });
        return this.#props.overrideHandler.createVisibilityHandlerResult({
          overrideProps: { node, on },
          nonOverriddenResult: result,
          override: this.#props.overrides?.changeElementGroupingNodeVisibilityStatus,
        });
      }

      if (!HierarchyNode.isInstancesNode(node)) {
        return EMPTY;
      }

      if (ModelsTreeNode.isSubjectNode(node)) {
        return this.#visibilityHelper.changeSubjectsVisibilityStatus({
          subjectIds: node.key.instanceKeys.map((key) => key.id),
          on,
        });
      }

      if (ModelsTreeNode.isModelNode(node)) {
        return this.#visibilityHelper.changeModelsVisibilityStatus({ modelIds: node.key.instanceKeys.map(({ id }) => id), on });
      }

      const modelId = ModelsTreeNode.getModelId(node);
      if (!modelId) {
        return EMPTY;
      }

      if (ModelsTreeNode.isCategoryNode(node)) {
        return this.#visibilityHelper.changeCategoriesVisibilityStatus({
          categoryIds: node.key.instanceKeys.map(({ id }) => id),
          modelId,
          on,
        });
      }

      const categoryId = ModelsTreeNode.getCategoryId(node);
      if (!categoryId) {
        return EMPTY;
      }

      return this.#visibilityHelper.changeElementsVisibilityStatus({
        elementIds: node.key.instanceKeys.map(({ id }) => id),
        modelId,
        categoryId,
        on,
      });
    });

    if (this.#props.viewport.isAlwaysDrawnExclusive) {
      return concat(this.#visibilityHelper.removeAlwaysDrawnExclusive(), changeObs);
    }
    return changeObs;
  }

  public getFilterTargetsVisibilityStatus(targets: ModelsTreeFilterTargets): Observable<VisibilityStatus> {
    return defer(() => {
      const { subjectIds, modelIds, categories, elements } = targets;
      const observables = new Array<Observable<VisibilityStatus>>();
      if (subjectIds?.size) {
        observables.push(this.#visibilityHelper.getSubjectsVisibilityStatus({ subjectIds }));
      }

      if (modelIds?.size) {
        observables.push(this.#visibilityHelper.getModelsVisibilityStatus({ modelIds, type: "GeometricModel3d" }));
      }

      if (categories?.length) {
        observables.push(
          from(categories).pipe(
            mergeMap(({ modelId, categoryIds }) =>
              this.#visibilityHelper.getCategoriesVisibilityStatus({
                categoryIds,
                modelId,
                type: "SpatialCategory",
                checkSubCategories: false,
              }),
            ),
          ),
        );
      }

      if (elements?.length) {
        observables.push(
          from(elements).pipe(
            releaseMainThreadOnItemsCount(50),
            mergeMap(({ modelId, elementIds, categoryId }) =>
              this.#visibilityHelper.getElementsVisibilityStatus({ modelId, categoryId, elementIds, type: "GeometricElement3d" }),
            ),
          ),
        );
      }

      return merge(...observables);
    }).pipe(mergeVisibilityStatuses);
  }

  private getGroupingNodeInfo(node: GroupingHierarchyNode) {
    const modelId = ModelsTreeNode.getModelId(node);
    const categoryId = ModelsTreeNode.getCategoryId(node);
    assert(!!modelId && !!categoryId);

    const elementIds = node.groupedInstanceKeys.map((key) => key.id);
    return { modelId, categoryId, elementIds };
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
  filteredPaths?: HierarchyFilteringPath[];
}) {
  return new HierarchyVisibilityHandlerImpl<ModelsTreeFilterTargets>({
    getFilteredTree: (): undefined | Promise<FilteredTree<ModelsTreeFilterTargets>> => {
      if (!props.filteredPaths) {
        return undefined;
      }
      return createFilteredModelsTree({
        filteringPaths: props.filteredPaths,
        imodelAccess: props.imodelAccess,
      });
    },
    getTreeSpecificVisibilityHandler: (info, overrideHandler) => {
      return new ModelsTreeVisibilityHandler({
        alwaysAndNeverDrawnElementInfo: info,
        idsCache: props.idsCache,
        viewport: props.viewport,
        overrideHandler,
        overrides: props.overrides,
      });
    },
    viewport: props.viewport,
  });
}
