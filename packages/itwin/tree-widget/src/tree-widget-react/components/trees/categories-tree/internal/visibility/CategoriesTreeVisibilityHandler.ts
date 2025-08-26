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
import { CategoriesTreeVisibilityHelper } from "./CategoriesTreeVisibilityHelper.js";

import type { Observable } from "rxjs";
import type { Viewport } from "@itwin/core-frontend";
import type { GroupingHierarchyNode } from "@itwin/presentation-hierarchies";
import type { AlwaysAndNeverDrawnElementInfo } from "../../../common/internal/AlwaysAndNeverDrawnElementInfo.js";
import type { ElementId, ModelId } from "../../../common/internal/Types.js";
import type { VisibilityStatus } from "../../../common/UseHierarchyVisibility.js";
import type { BaseIdsCache, TreeSpecificVisibilityHandler } from "../../../common/internal/visibility/BaseVisibilityHelper.js";
import type { CategoriesTreeIdsCache } from "../CategoriesTreeIdsCache.js";
import type { CategoriesTreeFilterTargets } from "./FilteredTree.js";

/** @internal */
export interface CategoriesTreeVisibilityHandlerProps {
  idsCache: CategoriesTreeIdsCache;
  viewport: Viewport;
  alwaysAndNeverDrawnElementInfo: AlwaysAndNeverDrawnElementInfo;
}

/**
 * Handles visibility status of categories tree nodes.
 *
 * This handler knows how to get and change visibility status of nodes created by hierarchy definition.
 * @internal
 */
export class CategoriesTreeVisibilityHandler implements Disposable, TreeSpecificVisibilityHandler<CategoriesTreeFilterTargets> {
  private _visibilityHelper: CategoriesTreeVisibilityHelper;
  private _elementType: "GeometricElement3d" | "GeometricElement2d";
  private _categoryType: "DrawingCategory" | "SpatialCategory";
  private _modelType: "GeometricModel3d" | "GeometricModel2d";
  constructor(private readonly _props: CategoriesTreeVisibilityHandlerProps) {
    const baseIdsCache: BaseIdsCache = {
      getCategories: (props) => this.getCategories(props),
      getElementsCount: (props) => this.getElementsCount(props),
      getModels: (props) => this.getModels(props),
      getSubCategories: (props) => this.getSubCategories(props),
      getSubModels: (props) => this.getSubModels(props),
      hasSubModel: async (props) => this._props.idsCache.hasSubModel(props),
    };
    this._visibilityHelper = new CategoriesTreeVisibilityHelper({
      viewport: this._props.viewport,
      idsCache: this._props.idsCache,
      alwaysAndNeverDrawnElementInfo: this._props.alwaysAndNeverDrawnElementInfo,
      baseIdsCache,
    });

    this._elementType = _props.viewport.view.is2d() ? "GeometricElement2d" : "GeometricElement3d";
    this._categoryType = _props.viewport.view.is2d() ? "DrawingCategory" : "SpatialCategory";
    this._modelType = _props.viewport.view.is2d() ? "GeometricModel2d" : "GeometricModel3d";
  }

  public [Symbol.dispose]() {
    this._visibilityHelper[Symbol.dispose]();
  }

  public changeFilterTargetsVisibilityStatus(targets: CategoriesTreeFilterTargets, on: boolean): Observable<void> {
    return defer(() => {
      const { definitionContainerIds, subCategories, modelIds, categories, elements } = targets;
      const observables = new Array<Observable<void>>();
      if (definitionContainerIds?.size) {
        observables.push(this._visibilityHelper.changeDefinitionContainersVisibilityStatus({ definitionContainerIds, on }));
      }

      if (modelIds?.size) {
        observables.push(this._visibilityHelper.changeModelsVisibilityStatus({ modelIds, on }));
      }

      if (categories?.length) {
        observables.push(
          from(categories).pipe(mergeMap(({ modelId, categoryIds }) => this._visibilityHelper.changeCategoriesVisibilityStatus({ categoryIds, modelId, on }))),
        );
      }

      if (subCategories?.length) {
        observables.push(
          from(subCategories).pipe(
            mergeMap(({ categoryId, subCategoryIds }) => this._visibilityHelper.changeSubCategoriesVisibilityStatus({ subCategoryIds, categoryId, on })),
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
      return this._visibilityHelper.getGroupedElementsVisibilityStatus({ categoryId: nodeInfo.categoryId, modelElementsMap: nodeInfo.modelElementsMap });
    }

    if (!HierarchyNode.isInstancesNode(node)) {
      return of(createVisibilityStatus("disabled"));
    }

    if (CategoriesTreeNode.isDefinitionContainerNode(node)) {
      return this._visibilityHelper.getDefinitionContainersVisibilityStatus({
        definitionContainerIds: node.key.instanceKeys.map((instanceKey) => instanceKey.id),
      });
    }

    if (CategoriesTreeNode.isModelNode(node)) {
      return this._visibilityHelper.getModelsVisibilityStatus({
        modelIds: node.key.instanceKeys.map((instanceKey) => instanceKey.id),
        type: this._modelType,
      });
    }

    if (CategoriesTreeNode.isCategoryNode(node)) {
      return this._visibilityHelper.getCategoriesVisibilityStatus({
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
      return this._visibilityHelper.getSubCategoriesVisibilityStatus({
        categoryId,
        subCategoryIds: node.key.instanceKeys.map((instanceKey) => instanceKey.id),
      });
    }

    const modelId = CategoriesTreeNode.getModelId(node);
    if (!modelId) {
      return of(createVisibilityStatus("disabled"));
    }
    return this._visibilityHelper.getElementsVisibilityStatus({
      elementIds: node.key.instanceKeys.map((instanceKey) => instanceKey.id),
      modelId,
      categoryId,
      type: this._elementType,
    });
  }

  /** Changes visibility of the items represented by the tree node. */
  public changeVisibilityStatus(node: HierarchyNode, on: boolean): Observable<void> {
    if (HierarchyNode.isClassGroupingNode(node)) {
      const nodeInfo = this.getGroupingNodeInfo(node);
      return this._visibilityHelper.changeGroupedElementsVisibilityStatus({
        categoryId: nodeInfo.categoryId,
        modelElementsMap: nodeInfo.modelElementsMap,
        on,
      });
    }

    if (!HierarchyNode.isInstancesNode(node)) {
      return EMPTY;
    }

    if (CategoriesTreeNode.isDefinitionContainerNode(node)) {
      return this._visibilityHelper.changeDefinitionContainersVisibilityStatus({
        definitionContainerIds: node.key.instanceKeys.map((instanceKey) => instanceKey.id),
        on,
      });
    }

    if (CategoriesTreeNode.isModelNode(node)) {
      return this._visibilityHelper.changeModelsVisibilityStatus({
        modelIds: node.key.instanceKeys.map(({ id }) => id),
        on,
      });
    }

    if (CategoriesTreeNode.isCategoryNode(node)) {
      return this._visibilityHelper.changeCategoriesVisibilityStatus({
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
      return this._visibilityHelper.changeSubCategoriesVisibilityStatus({
        categoryId,
        subCategoryIds: node.key.instanceKeys.map((instanceKey) => instanceKey.id),
        on,
      });
    }

    const modelId = CategoriesTreeNode.getModelId(node);
    if (!modelId) {
      return EMPTY;
    }

    return this._visibilityHelper.changeElementsVisibilityStatus({
      elementIds: node.key.instanceKeys.map(({ id }) => id),
      modelId,
      categoryId,
      on,
    });
  }

  public getFilterTargetsVisibilityStatus(targets: CategoriesTreeFilterTargets): Observable<VisibilityStatus> {
    return defer(() => {
      const { definitionContainerIds, subCategories, modelIds, categories, elements } = targets;
      const observables = new Array<Observable<VisibilityStatus>>();
      if (definitionContainerIds?.size) {
        observables.push(this._visibilityHelper.getDefinitionContainersVisibilityStatus({ definitionContainerIds }));
      }

      if (modelIds?.size) {
        observables.push(this._visibilityHelper.getModelsVisibilityStatus({ modelIds, type: this._modelType }));
      }

      if (categories?.length) {
        observables.push(
          from(categories).pipe(
            mergeMap(({ modelId, categoryIds }) =>
              this._visibilityHelper.getCategoriesVisibilityStatus({
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
            mergeMap(({ categoryId, subCategoryIds }) => this._visibilityHelper.getSubCategoriesVisibilityStatus({ subCategoryIds, categoryId })),
          ),
        );
      }

      if (elements?.length) {
        observables.push(
          from(elements).pipe(
            releaseMainThreadOnItemsCount(50),
            mergeMap(({ modelId, elementIds, categoryId }) =>
              this._visibilityHelper.getElementsVisibilityStatus({ modelId, categoryId, elementIds, type: this._elementType }),
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
        from(this._props.idsCache.getModelCategoryIds(modelId)).pipe(
          map((categories) => ({
            id: modelId,
            ...(this._props.viewport.view.is2d() ? { drawingCategories: categories } : { spatialCategories: categories }),
          })),
        ),
      ),
    );
  }

  private getElementsCount(props: Parameters<BaseIdsCache["getElementsCount"]>[0]): ReturnType<BaseIdsCache["getElementsCount"]> {
    return from(this._props.idsCache.getCategoryElementsCount(props.modelId, props.categoryId));
  }

  private getModels(props: Parameters<BaseIdsCache["getModels"]>[0]): ReturnType<BaseIdsCache["getModels"]> {
    return from(Id64.iterable(props.categoryIds)).pipe(
      mergeMap((categoryId) =>
        from(this._props.idsCache.getCategoriesElementModels(categoryId, true)).pipe(
          mergeMap((categoryModelsMap) => (categoryModelsMap.size > 0 ? categoryModelsMap.values() : of(undefined))),
          map((categoryModels) => ({ id: categoryId, models: categoryModels })),
        ),
      ),
    );
  }

  private getSubCategories(props: Parameters<BaseIdsCache["getSubCategories"]>[0]): ReturnType<BaseIdsCache["getSubCategories"]> {
    return from(Id64.iterable(props.categoryIds)).pipe(
      mergeMap((categoryId) =>
        from(this._props.idsCache.getSubCategories(categoryId)).pipe(
          mergeMap((categorySubCategoriesMap) => (categorySubCategoriesMap.size > 0 ? categorySubCategoriesMap.values() : of(undefined))),
          map((subCategories) => ({ id: categoryId, subCategories })),
        ),
      ),
    );
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
    const modelElementsMap: Map<ModelId, Set<ElementId>> = node.extendedData?.modelElementsMap;
    const categoryId = node.extendedData?.categoryId;
    assert(!!modelElementsMap && !!categoryId);

    return { modelElementsMap, categoryId };
  }
}
