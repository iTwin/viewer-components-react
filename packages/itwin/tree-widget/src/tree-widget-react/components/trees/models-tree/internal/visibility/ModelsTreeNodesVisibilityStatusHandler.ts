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
import { createVisibilityHandlerResult } from "../../../common/UseHierarchyVisibility.js";
import { ModelsTreeNode } from "../ModelsTreeNode.js";
import { ModelsTreeVisibilityStatusGetter } from "./ModelsTreeVisibilityStatusGetter.js";
import { ModelsTreeVisibilityStatusModifier } from "./ModelsTreeVisibilityStatusModifier.js";

import type { Observable } from "rxjs";
import type { Viewport } from "@itwin/core-frontend";
import type { GroupingHierarchyNode } from "@itwin/presentation-hierarchies";
import type { AlwaysAndNeverDrawnElementInfo } from "../../../common/internal/AlwaysAndNeverDrawnElementInfo.js";
import type { TreeNodesVisibilityStatusHandler, VisibilityStatusHelper } from "../../../common/internal/visibility/TreeVisibilityHandler.js";
import type { HierarchyVisibilityHandler, VisibilityStatus } from "../../../common/UseHierarchyVisibility.js";
import type { ModelsTreeIdsCache } from "../ModelsTreeIdsCache.js";
import type { ModelsTreeFilterTargets } from "./FilteredTree.js";
import type { ModelsTreeVisibilityHandlerOverrides } from "./ModelsTreeVisibilityHandler.js";

/** @internal */
export interface ModelsNodesVisibilityStatusHandlerProps {
  idsCache: ModelsTreeIdsCache;
  viewport: Viewport;
  alwaysAndNeverDrawnElementInfo: AlwaysAndNeverDrawnElementInfo;
  visibilityHandler: HierarchyVisibilityHandler;
  overrides?: ModelsTreeVisibilityHandlerOverrides;
}

/**
 * Handles visibility status of models tree nodes.
 *
 * It knows how to get and change visibility status of nodes created by hierarchy definition.
 * @internal
 */
export class ModelsTreeNodesVisibilityStatusHandler implements Disposable, TreeNodesVisibilityStatusHandler<ModelsTreeFilterTargets> {
  private _visibilityGetter: ModelsTreeVisibilityStatusGetter;
  private _visibilityModifier: ModelsTreeVisibilityStatusModifier;

  constructor(private readonly _props: ModelsNodesVisibilityStatusHandlerProps) {
    const visibilityStatusHelper: VisibilityStatusHelper = {
      getCategories: (props) => this.getCategories(props),
      getElementsCount: (props) => this.getElementsCount(props),
      getModels: (props) => this.getModels(props),
      getSubCategories: (props) => this.getSubCategories(props),
      getSubModels: (props) => this.getSubModels(props),
      hasSubModel: async (props) => this._props.idsCache.hasSubModel(props),
    };
    this._visibilityGetter = new ModelsTreeVisibilityStatusGetter({
      viewport: this._props.viewport,
      idsCache: this._props.idsCache,
      alwaysAndNeverDrawnElementInfo: this._props.alwaysAndNeverDrawnElementInfo,
      visibilityHandler: this._props.visibilityHandler,
      visibilityStatusHelper,
      overrides: this._props.overrides,
    });
    this._visibilityModifier = new ModelsTreeVisibilityStatusModifier({
      viewport: this._props.viewport,
      idsCache: this._props.idsCache,
      alwaysAndNeverDrawnElementInfo: this._props.alwaysAndNeverDrawnElementInfo,
      visibilityHandler: this._props.visibilityHandler,
      visibilityStatusHelper,
      visibilityStatusGetter: this._visibilityGetter,
      overrides: this._props.overrides,
    });
  }

  public [Symbol.dispose]() {
    this._visibilityModifier[Symbol.dispose]();
  }

  public changeFilterTargetsVisibilityStatusObs(targets: ModelsTreeFilterTargets, on: boolean): Observable<void> {
    return defer(() => {
      const { subjectIds, modelIds, categories, elements } = targets;
      const observables = new Array<Observable<void>>();
      if (subjectIds?.size) {
        observables.push(this._visibilityModifier.changeSubjectsVisibilityStatus({ subjectIds, on }));
      }

      if (modelIds?.size) {
        observables.push(this._visibilityModifier.changeModelsVisibilityStatus({ modelIds, on }));
      }

      if (categories?.length) {
        observables.push(
          from(categories).pipe(
            mergeMap(({ modelId, categoryIds }) =>
              this._visibilityModifier.changeCategoriesVisibilityStatus({
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
            mergeMap(({ modelId, elementIds, categoryId }) => this._visibilityModifier.changeElementsVisibilityStatus({ modelId, categoryId, elementIds, on })),
          ),
        );
      }

      return merge(...observables);
    });
  }

  public getVisibilityStatusObs(node: HierarchyNode): Observable<VisibilityStatus> {
    if (HierarchyNode.isClassGroupingNode(node)) {
      const nodeInfo = this.getGroupingNodeInfo(node);
      const result = this._visibilityGetter.getGroupedElementsVisibilityStatus({
        categoryId: nodeInfo.categoryId,
        modelId: nodeInfo.modelId,
        elementIds: nodeInfo.elementIds,
      });
      return createVisibilityHandlerResult(this._props.visibilityHandler, { node }, result, this._props.overrides?.getElementGroupingNodeVisibilityStatus);
    }

    if (!HierarchyNode.isInstancesNode(node)) {
      return of(createVisibilityStatus("disabled"));
    }

    if (ModelsTreeNode.isSubjectNode(node)) {
      // note: subject nodes may be merged to represent multiple subject instances
      return this._visibilityGetter.getSubjectsVisibilityStatus({ subjectIds: node.key.instanceKeys.map((key) => key.id) });
    }

    if (ModelsTreeNode.isModelNode(node)) {
      return this._visibilityGetter.getModelsVisibilityStatus({ modelIds: node.key.instanceKeys.map(({ id }) => id), type: "GeometricModel3d" });
    }

    const modelId = ModelsTreeNode.getModelId(node);
    if (!modelId) {
      return of(createVisibilityStatus("disabled"));
    }

    if (ModelsTreeNode.isCategoryNode(node)) {
      return this._visibilityGetter.getCategoriesVisibilityStatus({
        categoryIds: node.key.instanceKeys.map(({ id }) => id),
        modelId,
        type: "SpatialCategory",
      });
    }

    const categoryId = ModelsTreeNode.getCategoryId(node);
    if (!categoryId) {
      return of(createVisibilityStatus("disabled"));
    }

    return this._visibilityGetter.getElementsVisibilityStatus({
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
      const result = this._visibilityModifier.changeGroupedElementsVisibilityStatus({
        categoryId: nodeInfo.categoryId,
        modelId: nodeInfo.modelId,
        elementIds: nodeInfo.elementIds,
        on,
      });
      return createVisibilityHandlerResult(
        this._props.visibilityHandler,
        { node, on },
        result,
        this._props.overrides?.changeElementGroupingNodeVisibilityStatus,
      );
    }

    if (!HierarchyNode.isInstancesNode(node)) {
      return EMPTY;
    }

    if (ModelsTreeNode.isSubjectNode(node)) {
      return this._visibilityModifier.changeSubjectsVisibilityStatus({
        subjectIds: node.key.instanceKeys.map((key) => key.id),
        on,
      });
    }

    if (ModelsTreeNode.isModelNode(node)) {
      return this._visibilityModifier.changeModelsVisibilityStatus({ modelIds: node.key.instanceKeys.map(({ id }) => id), on });
    }

    const modelId = ModelsTreeNode.getModelId(node);
    if (!modelId) {
      return EMPTY;
    }

    if (ModelsTreeNode.isCategoryNode(node)) {
      return this._visibilityModifier.changeCategoriesVisibilityStatus({
        categoryIds: node.key.instanceKeys.map(({ id }) => id),
        modelId,
        on,
      });
    }

    const categoryId = ModelsTreeNode.getCategoryId(node);
    if (!categoryId) {
      return EMPTY;
    }

    return this._visibilityModifier.changeElementsVisibilityStatus({
      elementIds: node.key.instanceKeys.map(({ id }) => id),
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
        observables.push(this._visibilityGetter.getSubjectsVisibilityStatus({ subjectIds }));
      }

      if (modelIds?.size) {
        observables.push(this._visibilityGetter.getModelsVisibilityStatus({ modelIds, type: "GeometricModel3d" }));
      }

      if (categories?.length) {
        observables.push(
          from(categories).pipe(
            mergeMap(({ modelId, categoryIds }) =>
              this._visibilityGetter.getCategoriesVisibilityStatus({
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
              this._visibilityGetter.getElementsVisibilityStatus({ modelId, categoryId, elementIds, type: "GeometricElement3d" }),
            ),
          ),
        );
      }

      return merge(...observables);
    }).pipe(mergeVisibilityStatuses);
  }

  private getCategories(props: Parameters<VisibilityStatusHelper["getCategories"]>[0]): ReturnType<VisibilityStatusHelper["getCategories"]> {
    return from(Id64.iterable(props.modelIds)).pipe(
      mergeMap((modelId) =>
        from(this._props.idsCache.getModelCategoryIds(modelId)).pipe(map((categoryIds) => ({ id: modelId, spatialCategories: categoryIds }))),
      ),
    );
  }

  private getElementsCount(props: Parameters<VisibilityStatusHelper["getElementsCount"]>[0]): ReturnType<VisibilityStatusHelper["getElementsCount"]> {
    return from(this._props.idsCache.getCategoryElementsCount(props.modelId, props.categoryId));
  }

  private getModels(props: Parameters<VisibilityStatusHelper["getModels"]>[0]): ReturnType<VisibilityStatusHelper["getModels"]> {
    // Models cache for categories that dont have models still adds them to the final map
    return from(this._props.idsCache.getCategoriesElementModels(props.categoryIds)).pipe(
      mergeMap((categoryModelsMap) => categoryModelsMap.entries()),
      map(([categoryId, categoryModels]) => ({ id: categoryId, models: categoryModels })),
    );
  }

  private getSubCategories(props: Parameters<VisibilityStatusHelper["getSubCategories"]>[0]): ReturnType<VisibilityStatusHelper["getSubCategories"]> {
    return from(Id64.iterable(props.categoryIds)).pipe(map((categoryId) => ({ id: categoryId, subCategories: undefined })));
  }

  private getSubModels(props: Parameters<VisibilityStatusHelper["getSubModels"]>[0]): ReturnType<VisibilityStatusHelper["getSubModels"]> {
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
              return of({ id: categoryId, subModels: undefined });
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

    const elementIds = node.groupedInstanceKeys.map((key) => key.id);
    return { modelId, categoryId, elementIds };
  }
}
