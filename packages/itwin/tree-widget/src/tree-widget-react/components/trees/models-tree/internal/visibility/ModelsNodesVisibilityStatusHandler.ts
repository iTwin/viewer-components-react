/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { defer, EMPTY, from, map, merge, mergeMap, of } from "rxjs";
import { assert, Id64 } from "@itwin/core-bentley";
import { HierarchyNode } from "@itwin/presentation-hierarchies";
import { createVisibilityStatus } from "../../../common/internal/Tooltip.js";
import { releaseMainThreadOnItemsCount } from "../../../common/internal/Utils.js";
import { mergeVisibilityStatuses } from "../../../common/internal/VisibilityUtils.js";
import { ModelsTreeNode } from "./ModelsTreeNode.js";
import { ModelsVisibilityStatusHelper } from "./ModelsVisibilityHelper.js";

import type { GroupingHierarchyNode } from "@itwin/presentation-hierarchies";
import type { Viewport } from "@itwin/core-frontend";
import type { AlwaysAndNeverDrawnElementInfo } from "../../../common/internal/AlwaysAndNeverDrawnElementInfo.js";
import type { BaseVisibilityStatusHelperProps } from "../../../common/internal/visibility/BaseVisibilityStatusHelper.js";
import type { NodesVisibilityStatusHandler } from "../../../common/internal/visibility/TreeVisibilityHandler.js";
import type { Observable } from "rxjs";
import type { ModelId } from "../../../common/internal/Types.js";
import type { VisibilityStatus } from "../../../common/UseHierarchyVisibility.js";
import type { ModelsTreeIdsCache } from "../ModelsTreeIdsCache.js";
import type { ModelsTreeFilterTargets } from "./FilteredTree.js";
/**
 * @internal
 */
export interface ModelsNodesVisibilityStatusHandlerProps {
  idsCache: ModelsTreeIdsCache;
  viewport: Viewport;
  alwaysAndNeverDrawnElementInfo: AlwaysAndNeverDrawnElementInfo;
}

/**
 * @internal
 */
export class ModelsNodesVisibilityStatusHandler implements Disposable, NodesVisibilityStatusHandler<ModelsTreeFilterTargets> {
  private _visibilityHelper: ModelsVisibilityStatusHelper;

  constructor(private readonly _props: ModelsNodesVisibilityStatusHandlerProps) {
    this._visibilityHelper = new ModelsVisibilityStatusHelper({
      alwaysAndNeverDrawnElementInfo: this._props.alwaysAndNeverDrawnElementInfo,
      viewport: this._props.viewport,
      idsCache: this._props.idsCache,
      getCategories: (props) => this.getCategories(props),
      getElementsCount: (props) => this.getElementsCount(props),
      getModels: (props) => this.getModels(props),
      getSubCategories: (props) => this.getSubCategories(props),
      getSubModels: (props) => this.getSubModels(props),
      hasSubModel: async (props) => this._props.idsCache.hasSubModel(props),
    });
  }

  public [Symbol.dispose]() {
    this._visibilityHelper[Symbol.dispose]();
  }

  public changeFilterTargetsVisibilityStatusObs(targets: ModelsTreeFilterTargets, on: boolean): Observable<void> {
    return defer(() => {
      const { subjectIds, modelIds, categories, elements } = targets;
      const observables = new Array<Observable<void>>();
      if (subjectIds?.size) {
        observables.push(this._visibilityHelper.changeSubjectsVisibilityStatus({ subjectIds, on }));
      }

      if (modelIds?.size) {
        observables.push(this._visibilityHelper.changeModelsVisibilityStatus({ modelIds, on }));
      }

      if (categories?.length) {
        observables.push(
          from(categories).pipe(
            mergeMap(({ modelId, categoryIds }) =>
              this._visibilityHelper.changeCategoriesVisibilityStatus({
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
            mergeMap(({ modelId, elementIds, categoryId }) => this._visibilityHelper.changeElementsVisibilityStatus({ modelId, categoryId, elementIds, on })),
          ),
        );
      }

      return merge(...observables);
    });
  }

  public getVisibilityStatusObs(node: HierarchyNode): Observable<VisibilityStatus> {
    if (HierarchyNode.isClassGroupingNode(node)) {
      const nodeInfo = this.getGroupingNodeInfo(node);
      return this._visibilityHelper.getGroupedElementsVisibilityStatus({
        categoryId: nodeInfo.categoryId,
        modelElementsMap: new Map([[nodeInfo.modelId, nodeInfo.elementIds]]),
        type: "GeometricElement3d",
      });
    }

    if (!HierarchyNode.isInstancesNode(node)) {
      return of(createVisibilityStatus("disabled"));
    }

    if (ModelsTreeNode.isSubjectNode(node)) {
      // note: subject nodes may be merged to represent multiple subject instances
      return this._visibilityHelper.getSubjectsVisibilityStatus({ subjectIds: node.key.instanceKeys.map((key) => key.id) });
    }

    if (ModelsTreeNode.isModelNode(node)) {
      return this._visibilityHelper.getModelsVisibilityStatus({ modelIds: node.key.instanceKeys.map(({ id }) => id), type: "GeometricModel3d" });
    }

    const modelId = ModelsTreeNode.getModelId(node);
    if (!modelId) {
      return of(createVisibilityStatus("disabled"));
    }

    if (ModelsTreeNode.isCategoryNode(node)) {
      return this._visibilityHelper.getCategoriesVisibilityStatus({
        categoryIds: node.key.instanceKeys.map(({ id }) => id),
        modelId,
        type: "SpatialCategory",
      });
    }

    const categoryId = ModelsTreeNode.getCategoryId(node);
    if (!categoryId) {
      return of(createVisibilityStatus("disabled"));
    }

    return this._visibilityHelper.getElementsVisibilityStatus({
      elementIds: node.key.instanceKeys.map(({ id }) => id),
      modelId,
      categoryId,
      type: "GeometricElement3d",
    });
  }

  /** Changes visibility of the items represented by the tree node. */
  public changeVisibilityStatusObs(node: HierarchyNode, on: boolean): Observable<void> {
    if (HierarchyNode.isClassGroupingNode(node)) {
      const nodeInfo = this.getGroupingNodeInfo(node);
      return this._visibilityHelper.changeGroupedElementsVisibilityStatus({
        categoryId: nodeInfo.categoryId,
        modelElementsMap: new Map([[nodeInfo.modelId, nodeInfo.elementIds]]),
        on,
      });
    }

    if (!HierarchyNode.isInstancesNode(node)) {
      return EMPTY;
    }

    if (ModelsTreeNode.isSubjectNode(node)) {
      return this._visibilityHelper.changeSubjectsVisibilityStatus({
        subjectIds: node.key.instanceKeys.map((key) => key.id),
        on,
      });
    }

    if (ModelsTreeNode.isModelNode(node)) {
      return this._visibilityHelper.changeModelsVisibilityStatus({ modelIds: node.key.instanceKeys.map(({ id }) => id), on });
    }

    const modelId = ModelsTreeNode.getModelId(node);
    if (!modelId) {
      return EMPTY;
    }

    if (ModelsTreeNode.isCategoryNode(node)) {
      return this._visibilityHelper.changeCategoriesVisibilityStatus({
        categoryIds: node.key.instanceKeys.map(({ id }) => id),
        modelId,
        on,
      });
    }

    const categoryId = ModelsTreeNode.getCategoryId(node);
    if (!categoryId) {
      return EMPTY;
    }

    return this._visibilityHelper.changeElementsVisibilityStatus({
      elementIds: new Set([...node.key.instanceKeys.map(({ id }) => id)]),
      modelId,
      categoryId,
      on,
    });
  }

  public getFilterTargetsVisibilityStatusObs(targets: ModelsTreeFilterTargets): Observable<VisibilityStatus> {
    return defer(() => {
      const { subjectIds, modelIds, categories, elements } = targets;
      const observables = new Array<Observable<VisibilityStatus>>();
      if (subjectIds?.size) {
        observables.push(this._visibilityHelper.getSubjectsVisibilityStatus({ subjectIds }));
      }

      if (modelIds?.size) {
        observables.push(this._visibilityHelper.getModelsVisibilityStatus({ modelIds, type: "GeometricModel3d" }));
      }

      if (categories?.length) {
        observables.push(
          from(categories).pipe(
            mergeMap(({ modelId, categoryIds }) =>
              this._visibilityHelper.getCategoriesVisibilityStatus({
                categoryIds,
                modelId,
                type: "SpatialCategory",
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
              this._visibilityHelper.getElementsVisibilityStatus({ modelId, categoryId, elementIds, type: "GeometricElement3d" }),
            ),
          ),
        );
      }

      return merge(...observables);
    }).pipe(mergeVisibilityStatuses);
  }

  private getCategories(props: Parameters<BaseVisibilityStatusHelperProps["getCategories"]>[0]): ReturnType<BaseVisibilityStatusHelperProps["getCategories"]> {
    return from(Id64.iterable(props.modelIds)).pipe(
      mergeMap((modelId) =>
        from(this._props.idsCache.getModelCategoryIds(modelId)).pipe(map((categoryIds) => ({ id: modelId, spatialCategories: categoryIds }))),
      ),
    );
  }

  private getElementsCount(
    props: Parameters<BaseVisibilityStatusHelperProps["getElementsCount"]>[0],
  ): ReturnType<BaseVisibilityStatusHelperProps["getElementsCount"]> {
    return from(this._props.idsCache.getCategoryElementsCount(props.modelId, props.categoryId));
  }

  private getModels(props: Parameters<BaseVisibilityStatusHelperProps["getModels"]>[0]): ReturnType<BaseVisibilityStatusHelperProps["getModels"]> {
    // Models cache for categories that dont have models still adds them to the final map
    return from(this._props.idsCache.getCategoriesElementModels(props.categoryIds)).pipe(
      mergeMap((categoryModelsMap) => categoryModelsMap.entries()),
      map(([categoryId, categoryModels]) => ({ id: categoryId, models: categoryModels })),
    );
  }

  private getSubCategories(
    props: Parameters<BaseVisibilityStatusHelperProps["getSubCategories"]>[0],
  ): ReturnType<BaseVisibilityStatusHelperProps["getSubCategories"]> {
    return from(Id64.iterable(props.categoryIds)).pipe(map((categoryId) => ({ id: categoryId, subCategories: [] })));
  }

  private getSubModels(props: Parameters<BaseVisibilityStatusHelperProps["getSubModels"]>[0]): ReturnType<BaseVisibilityStatusHelperProps["getSubModels"]> {
    if ("modelIds" in props) {
      return from(Id64.iterable(props.modelIds)).pipe(
        mergeMap((modelId) =>
          from(this._props.idsCache.getModelCategoryIds(modelId)).pipe(
            mergeMap((categoryIds) => from(this._props.idsCache.getCategoriesModeledElements(modelId, categoryIds))),
            map((subModels) => ({ id: modelId, subModels })),
          ),
        ),
      );
    }

    if (props.modelId) {
      return from(Id64.iterable(props.categoryIds)).pipe(
        mergeMap((categoryId) =>
          from(this._props.idsCache.getCategoriesModeledElements(props.modelId!, categoryId)).pipe(map((subModels) => ({ id: categoryId, subModels }))),
        ),
      );
    }

    return from(Id64.iterable(props.categoryIds)).pipe(
      mergeMap((categoryId) =>
        from(this._props.idsCache.getCategoriesElementModels(categoryId)).pipe(
          mergeMap((categoryModelsMap) => {
            const models = categoryModelsMap.get(categoryId);
            if (!models) {
              return of({ id: categoryId, subModels: new Array<ModelId>() });
            }
            return from(models).pipe(
              mergeMap((modelId) => from(this._props.idsCache.getCategoriesModeledElements(modelId, categoryId))),
              map((subModels) => ({ id: categoryId, subModels })),
            );
          }),
        ),
      ),
    );
  }

  private getGroupingNodeInfo(node: GroupingHierarchyNode) {
    const modelId = ModelsTreeNode.getModelId(node);
    const categoryId = ModelsTreeNode.getCategoryId(node);
    assert(!!modelId && !!categoryId);

    const elementIds = new Set(node.groupedInstanceKeys.map((key) => key.id));
    return { modelId, categoryId, elementIds };
  }
}
