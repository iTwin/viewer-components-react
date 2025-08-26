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
import { ModelsTreeNode } from "../ModelsTreeNode.js";
import { ModelsTreeVisibilityHelper } from "./ModelsTreeVisibilityHelper.js";

import type { Observable } from "rxjs";
import type { Id64Arg } from "@itwin/core-bentley";
import type { Viewport } from "@itwin/core-frontend";
import type { GroupingHierarchyNode } from "@itwin/presentation-hierarchies";
import type { AlwaysAndNeverDrawnElementInfo } from "../../../common/internal/AlwaysAndNeverDrawnElementInfo.js";
import type {
  BaseIdsCache,
  BaseTreeVisibilityHandlerOverrides,
  TreeSpecificVisibilityHandler,
} from "../../../common/internal/visibility/BaseVisibilityHelper.js";
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
  viewport: Viewport;
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
  private _visibilityHelper: ModelsTreeVisibilityHelper;

  constructor(private readonly _props: ModelsTreeVisibilityHandlerProps) {
    const baseIdsCache: BaseIdsCache = {
      getCategories: (props) => this.getCategories(props),
      getElementsCount: (props) => this.getElementsCount(props),
      getModels: (props) => this.getModels(props),
      getSubCategories: (props) => this.getSubCategories(props),
      getSubModels: (props) => this.getSubModels(props),
      hasSubModel: async (props) => this._props.idsCache.hasSubModel(props),
    };
    this._visibilityHelper = new ModelsTreeVisibilityHelper({
      viewport: this._props.viewport,
      idsCache: this._props.idsCache,
      alwaysAndNeverDrawnElementInfo: this._props.alwaysAndNeverDrawnElementInfo,
      overrideHandler: this._props.overrideHandler,
      baseIdsCache,
      overrides: this._props.overrides,
    });
  }

  public [Symbol.dispose]() {
    this._visibilityHelper[Symbol.dispose]();
  }

  public changeFilterTargetsVisibilityStatus(targets: ModelsTreeFilterTargets, on: boolean): Observable<void> {
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

  public getVisibilityStatus(node: HierarchyNode): Observable<VisibilityStatus> {
    if (HierarchyNode.isClassGroupingNode(node)) {
      const nodeInfo = this.getGroupingNodeInfo(node);
      const result = this._visibilityHelper.getGroupedElementsVisibilityStatus({
        categoryId: nodeInfo.categoryId,
        modelId: nodeInfo.modelId,
        elementIds: nodeInfo.elementIds,
      });
      return this._props.overrideHandler.createVisibilityHandlerResult({
        overrideProps: { node },
        nonOverridenResult: result,
        override: this._props.overrides?.getElementGroupingNodeVisibilityStatus,
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
  public changeVisibilityStatus(node: HierarchyNode, on: boolean): Observable<void> {
    if (HierarchyNode.isClassGroupingNode(node)) {
      const nodeInfo = this.getGroupingNodeInfo(node);
      const result = this._visibilityHelper.changeGroupedElementsVisibilityStatus({
        categoryId: nodeInfo.categoryId,
        modelId: nodeInfo.modelId,
        elementIds: nodeInfo.elementIds,
        on,
      });
      return this._props.overrideHandler.createVisibilityHandlerResult({
        overrideProps: { node, on },
        nonOverridenResult: result,
        override: this._props.overrides?.changeElementGroupingNodeVisibilityStatus,
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
      elementIds: node.key.instanceKeys.map(({ id }) => id),
      modelId,
      categoryId,
      on,
    });
  }

  public getFilterTargetsVisibilityStatus(targets: ModelsTreeFilterTargets): Observable<VisibilityStatus> {
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

  private getCategories(props: Parameters<BaseIdsCache["getCategories"]>[0]): ReturnType<BaseIdsCache["getCategories"]> {
    return from(Id64.iterable(props.modelIds)).pipe(
      mergeMap((modelId) =>
        from(this._props.idsCache.getModelCategoryIds(modelId)).pipe(map((categoryIds) => ({ id: modelId, spatialCategories: categoryIds }))),
      ),
    );
  }

  private getElementsCount(props: Parameters<BaseIdsCache["getElementsCount"]>[0]): ReturnType<BaseIdsCache["getElementsCount"]> {
    return from(this._props.idsCache.getCategoryElementsCount(props.modelId, props.categoryId));
  }

  private getModels(props: Parameters<BaseIdsCache["getModels"]>[0]): ReturnType<BaseIdsCache["getModels"]> {
    // Models cache for categories that dont have models still adds them to the final map
    return from(this._props.idsCache.getCategoriesElementModels(props.categoryIds)).pipe(
      mergeMap((categoryModelsMap) => categoryModelsMap.entries()),
      map(([categoryId, categoryModels]) => ({ id: categoryId, models: categoryModels })),
    );
  }

  private getSubCategories(props: Parameters<BaseIdsCache["getSubCategories"]>[0]): ReturnType<BaseIdsCache["getSubCategories"]> {
    return from(Id64.iterable(props.categoryIds)).pipe(map((categoryId) => ({ id: categoryId, subCategories: undefined })));
  }

  private getSubModels(props: Parameters<BaseIdsCache["getSubModels"]>[0]): ReturnType<BaseIdsCache["getSubModels"]> {
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
