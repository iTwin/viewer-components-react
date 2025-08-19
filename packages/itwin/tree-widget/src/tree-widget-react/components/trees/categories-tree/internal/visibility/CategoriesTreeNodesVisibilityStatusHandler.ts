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
import { CategoriesTreeNode } from "../CategoriesTreeNode.js";
import { CategoriesTreeVisibilityStatusGetter } from "./CategoriesTreeVisibilityStatusGetter.js";
import { CategoriesTreeVisibilityStatusModifier } from "./CategoriesTreeVisibilityStatusModifier.js";

import type { Observable } from "rxjs";
import type { Viewport } from "@itwin/core-frontend";
import type { GroupingHierarchyNode } from "@itwin/presentation-hierarchies";
import type { AlwaysAndNeverDrawnElementInfo } from "../../../common/internal/AlwaysAndNeverDrawnElementInfo.js";
import type { ElementId, ModelId } from "../../../common/internal/Types.js";
import type { TreeNodesVisibilityStatusHandler, VisibilityStatusHelper } from "../../../common/internal/visibility/TreeVisibilityHandler.js";
import type { HierarchyVisibilityHandler, VisibilityStatus } from "../../../common/UseHierarchyVisibility.js";
import type { CategoriesTreeIdsCache } from "../CategoriesTreeIdsCache.js";
import type { CategoriesTreeFilterTargets } from "./FilteredTree.js";

/** @internal */
export interface CategoriesTreeNodesVisibilityStatusHandlerProps {
  idsCache: CategoriesTreeIdsCache;
  viewport: Viewport;
  alwaysAndNeverDrawnElementInfo: AlwaysAndNeverDrawnElementInfo;
  visibilityHandler: HierarchyVisibilityHandler;
}

/**
 * Handles visibility status of categories tree nodes.
 *
 * This handler knows how to get and change visibility status of nodes created by hierarchy definition.
 * @internal
 */
export class CategoriesTreeNodesVisibilityStatusHandler implements Disposable, TreeNodesVisibilityStatusHandler<CategoriesTreeFilterTargets> {
  private _visibilityGetter: CategoriesTreeVisibilityStatusGetter;
  private _visibilityModifier: CategoriesTreeVisibilityStatusModifier;
  private _elementType: "GeometricElement3d" | "GeometricElement2d";
  private _categoryType: "DrawingCategory" | "SpatialCategory";
  private _modelType: "GeometricModel3d" | "GeometricModel2d";

  constructor(private readonly _props: CategoriesTreeNodesVisibilityStatusHandlerProps) {
    const visibilityStatusHelper: VisibilityStatusHelper = {
      getCategories: (props) => this.getCategories(props),
      getElementsCount: (props) => this.getElementsCount(props),
      getModels: (props) => this.getModels(props),
      getSubCategories: (props) => this.getSubCategories(props),
      getSubModels: (props) => this.getSubModels(props),
      hasSubModel: async (props) => this._props.idsCache.hasSubModel(props),
    };
    this._visibilityGetter = new CategoriesTreeVisibilityStatusGetter({
      viewport: this._props.viewport,
      idsCache: this._props.idsCache,
      alwaysAndNeverDrawnElementInfo: this._props.alwaysAndNeverDrawnElementInfo,
      visibilityHandler: this._props.visibilityHandler,
      visibilityStatusHelper,
    });
    this._visibilityModifier = new CategoriesTreeVisibilityStatusModifier({
      viewport: this._props.viewport,
      idsCache: this._props.idsCache,
      alwaysAndNeverDrawnElementInfo: this._props.alwaysAndNeverDrawnElementInfo,
      visibilityHandler: this._props.visibilityHandler,
      visibilityStatusHelper,
      visibilityStatusGetter: this._visibilityGetter,
    });

    this._elementType = _props.viewport.view.is2d() ? "GeometricElement2d" : "GeometricElement3d";
    this._categoryType = _props.viewport.view.is2d() ? "DrawingCategory" : "SpatialCategory";
    this._modelType = _props.viewport.view.is2d() ? "GeometricModel2d" : "GeometricModel3d";
  }

  public [Symbol.dispose]() {
    this._visibilityModifier[Symbol.dispose]();
  }

  public changeFilterTargetsVisibilityStatusObs(targets: CategoriesTreeFilterTargets, on: boolean): Observable<void> {
    return defer(() => {
      const { definitionContainerIds, subCategories, modelIds, categories, elements } = targets;
      const observables = new Array<Observable<void>>();
      if (definitionContainerIds?.size) {
        observables.push(this._visibilityModifier.changeDefinitionContainersVisibilityStatus({ definitionContainerIds, on }));
      }

      if (modelIds?.size) {
        observables.push(this._visibilityModifier.changeModelsVisibilityStatus({ modelIds, on }));
      }

      if (categories?.length) {
        observables.push(
          from(categories).pipe(
            mergeMap(({ modelId, categoryIds }) => this._visibilityModifier.changeCategoriesVisibilityStatus({ categoryIds, modelId, on })),
          ),
        );
      }

      if (subCategories?.length) {
        observables.push(
          from(subCategories).pipe(
            mergeMap(({ categoryId, subCategoryIds }) => this._visibilityModifier.changeSubCategoriesVisibilityStatus({ subCategoryIds, categoryId, on })),
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
      return this._visibilityGetter.getGroupedElementsVisibilityStatus({ categoryId: nodeInfo.categoryId, modelElementsMap: nodeInfo.modelElementsMap });
    }

    if (!HierarchyNode.isInstancesNode(node)) {
      return of(createVisibilityStatus("disabled"));
    }

    if (CategoriesTreeNode.isDefinitionContainerNode(node)) {
      return this._visibilityGetter.getDefinitionContainersVisibilityStatus({
        definitionContainerIds: node.key.instanceKeys.map((instanceKey) => instanceKey.id),
      });
    }

    if (CategoriesTreeNode.isModelNode(node)) {
      return this._visibilityGetter.getModelsVisibilityStatus({
        modelIds: node.key.instanceKeys.map((instanceKey) => instanceKey.id),
        type: this._modelType,
      });
    }

    if (CategoriesTreeNode.isCategoryNode(node)) {
      return this._visibilityGetter.getCategoriesVisibilityStatus({
        categoryIds: node.key.instanceKeys.map((instanceKey) => instanceKey.id),
        modelId: CategoriesTreeNode.getModelId(node),
        type: this._categoryType,
      });
    }

    const categoryId = CategoriesTreeNode.getCategoryId(node);
    if (!categoryId) {
      return of(createVisibilityStatus("disabled"));
    }

    if (CategoriesTreeNode.isSubCategoryNode(node)) {
      return this._visibilityGetter.getSubCategoriesVisibilityStatus({
        categoryId,
        subCategoryIds: node.key.instanceKeys.map((instanceKey) => instanceKey.id),
      });
    }

    const modelId = CategoriesTreeNode.getModelId(node);
    if (!modelId) {
      return of(createVisibilityStatus("disabled"));
    }
    return this._visibilityGetter.getElementsVisibilityStatus({
      elementIds: node.key.instanceKeys.map((instanceKey) => instanceKey.id),
      modelId,
      categoryId,
      type: this._elementType,
    });
  }

  /** Changes visibility of the items represented by the tree node. */
  public changeVisibilityStatusObs(node: HierarchyNode, on: boolean): Observable<void> {
    if (HierarchyNode.isClassGroupingNode(node)) {
      const nodeInfo = this.getGroupingNodeInfo(node);
      return this._visibilityModifier.changeGroupedElementsVisibilityStatus({
        categoryId: nodeInfo.categoryId,
        modelElementsMap: nodeInfo.modelElementsMap,
        on,
      });
    }

    if (!HierarchyNode.isInstancesNode(node)) {
      return EMPTY;
    }

    if (CategoriesTreeNode.isDefinitionContainerNode(node)) {
      return this._visibilityModifier.changeDefinitionContainersVisibilityStatus({
        definitionContainerIds: node.key.instanceKeys.map((instanceKey) => instanceKey.id),
        on,
      });
    }

    if (CategoriesTreeNode.isModelNode(node)) {
      return this._visibilityModifier.changeModelsVisibilityStatus({
        modelIds: node.key.instanceKeys.map(({ id }) => id),
        on,
      });
    }

    if (CategoriesTreeNode.isCategoryNode(node)) {
      return this._visibilityModifier.changeCategoriesVisibilityStatus({
        categoryIds: node.key.instanceKeys.map((instanceKey) => instanceKey.id),
        modelId: CategoriesTreeNode.getModelId(node),
        on,
      });
    }

    const categoryId = CategoriesTreeNode.getCategoryId(node);
    if (!categoryId) {
      return EMPTY;
    }

    if (CategoriesTreeNode.isSubCategoryNode(node)) {
      return this._visibilityModifier.changeSubCategoriesVisibilityStatus({
        categoryId,
        subCategoryIds: node.key.instanceKeys.map((instanceKey) => instanceKey.id),
        on,
      });
    }

    const modelId = CategoriesTreeNode.getModelId(node);
    if (!modelId) {
      return EMPTY;
    }

    return this._visibilityModifier.changeElementsVisibilityStatus({
      elementIds: node.key.instanceKeys.map(({ id }) => id),
      modelId,
      categoryId,
      on,
    });
  }

  public getFilterTargetsVisibilityStatusObs(targets: CategoriesTreeFilterTargets): Observable<VisibilityStatus> {
    return defer(() => {
      const { definitionContainerIds, subCategories, modelIds, categories, elements } = targets;
      const observables = new Array<Observable<VisibilityStatus>>();
      if (definitionContainerIds?.size) {
        observables.push(this._visibilityGetter.getDefinitionContainersVisibilityStatus({ definitionContainerIds }));
      }

      if (modelIds?.size) {
        observables.push(this._visibilityGetter.getModelsVisibilityStatus({ modelIds, type: this._modelType }));
      }

      if (categories?.length) {
        observables.push(
          from(categories).pipe(
            mergeMap(({ modelId, categoryIds }) =>
              this._visibilityGetter.getCategoriesVisibilityStatus({
                categoryIds,
                modelId,
                type: this._categoryType,
              }),
            ),
          ),
        );
      }

      if (subCategories?.length) {
        observables.push(
          from(subCategories).pipe(
            mergeMap(({ categoryId, subCategoryIds }) => this._visibilityGetter.getSubCategoriesVisibilityStatus({ subCategoryIds, categoryId })),
          ),
        );
      }

      if (elements?.length) {
        observables.push(
          from(elements).pipe(
            releaseMainThreadOnItemsCount(50),
            mergeMap(({ modelId, elementIds, categoryId }) =>
              this._visibilityGetter.getElementsVisibilityStatus({ modelId, categoryId, elementIds, type: this._elementType }),
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
        from(this._props.idsCache.getModelCategoryIds(modelId)).pipe(
          map((categories) => ({
            id: modelId,
            ...(this._props.viewport.view.is2d() ? { drawingCategories: categories } : { spatialCategories: categories }),
          })),
        ),
      ),
    );
  }

  private getElementsCount(props: Parameters<VisibilityStatusHelper["getElementsCount"]>[0]): ReturnType<VisibilityStatusHelper["getElementsCount"]> {
    return from(this._props.idsCache.getCategoryElementsCount(props.modelId, props.categoryId));
  }

  private getModels(props: Parameters<VisibilityStatusHelper["getModels"]>[0]): ReturnType<VisibilityStatusHelper["getModels"]> {
    return from(Id64.iterable(props.categoryIds)).pipe(
      mergeMap((categoryId) =>
        from(this._props.idsCache.getCategoriesElementModels(categoryId, true)).pipe(
          mergeMap((categoryModelsMap) => (categoryModelsMap.size > 0 ? categoryModelsMap.values() : of(undefined))),
          map((categoryModels) => ({ id: categoryId, models: categoryModels })),
        ),
      ),
    );
  }

  private getSubCategories(props: Parameters<VisibilityStatusHelper["getSubCategories"]>[0]): ReturnType<VisibilityStatusHelper["getSubCategories"]> {
    return from(Id64.iterable(props.categoryIds)).pipe(
      mergeMap((categoryId) =>
        from(this._props.idsCache.getSubCategories(categoryId)).pipe(
          mergeMap((categorySubCategoriesMap) => (categorySubCategoriesMap.size > 0 ? categorySubCategoriesMap.values() : of(undefined))),
          map((subCategories) => ({ id: categoryId, subCategories })),
        ),
      ),
    );
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
    const modelElementsMap: Map<ModelId, Set<ElementId>> = node.extendedData?.modelElementsMap;
    const categoryId = node.extendedData?.categoryId;
    assert(!!modelElementsMap && !!categoryId);

    return { modelElementsMap, categoryId };
  }
}
