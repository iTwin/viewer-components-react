/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { defer, EMPTY, from, map, merge, mergeMap, of } from "rxjs";
import { Id64 } from "@itwin/core-bentley";
import { HierarchyNode } from "@itwin/presentation-hierarchies";
import { createVisibilityStatus } from "../../../common/internal/Tooltip.js";
import { getArrayFromId64Arg, releaseMainThreadOnItemsCount } from "../../../common/internal/Utils.js";
import { mergeVisibilityStatuses } from "../../../common/internal/VisibilityUtils.js";
import { CategoriesTreeNode } from "./CategoriesTreeNode.js";
import { CategoriesVisibilityStatusHelper } from "./CategoriesVisibilityStatusHelper.js";

import type { Id64String } from "@itwin/core-bentley";
import type { Viewport } from "@itwin/core-frontend";
import type { ClassGroupingNodeKey, GroupingHierarchyNode } from "@itwin/presentation-hierarchies";
import type { AlwaysAndNeverDrawnElementInfo } from "../../../common/internal/AlwaysAndNeverDrawnElementInfo.js";
import type { BaseVisibilityStatusHelperProps } from "../../../common/internal/visibility/BaseVisibilityStatusHelper.js";
import type { NodesVisibilityStatusHandler } from "../../../common/internal/visibility/TreeVisibilityHandler.js";
import type { CategoriesTreeIdsCache } from "../CategoriesTreeIdsCache.js";
import type { Observable } from "rxjs";
import type { CategoriesTreeFilterTargets } from "./FilteredTree.js";
import type { ElementId, ModelId, SubCategoryId } from "../../../common/internal/Types.js";
import type { VisibilityStatus } from "../../../common/UseHierarchyVisibility.js";

/**
 * @internal
 */
export interface CategoriesNodesVisibilityStatusHandlerProps {
  idsCache: CategoriesTreeIdsCache;
  viewport: Viewport;
  alwaysAndNeverDrawnElementInfo: AlwaysAndNeverDrawnElementInfo;
}

/**
 * @internal
 */
export class CategoriesNodesVisibilityStatusHandler implements Disposable, NodesVisibilityStatusHandler<CategoriesTreeFilterTargets> {
  private _visibilityHelper: CategoriesVisibilityStatusHelper;
  private _elementType: "GeometricElement3d" | "GeometricElement2d";
  private _categoryType: "DrawingCategory" | "SpatialCategory";
  private _modelType: "GeometricModel3d" | "GeometricModel2d";

  constructor(private readonly _props: CategoriesNodesVisibilityStatusHandlerProps) {
    this._visibilityHelper = new CategoriesVisibilityStatusHelper({
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
    this._elementType = _props.viewport.view.is2d() ? "GeometricElement2d" : "GeometricElement3d";
    this._categoryType = _props.viewport.view.is2d() ? "DrawingCategory" : "SpatialCategory";
    this._modelType = _props.viewport.view.is2d() ? "GeometricModel2d" : "GeometricModel3d";
  }

  public [Symbol.dispose]() {
    this._visibilityHelper[Symbol.dispose]();
  }

  public changeFilterTargetsVisibilityStatusObs(targets: CategoriesTreeFilterTargets, on: boolean): Observable<void> {
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

  public getVisibilityStatusObs(node: HierarchyNode): Observable<VisibilityStatus> {
    if (CategoriesTreeNode.isElementClassGroupingNode(node)) {
      const info = this.getGroupingNodeInfo(node);

      const { modelElementsMap, categoryId } = info;
      return this._visibilityHelper.getGroupedElementsVisibilityStatus({ modelElementsMap, categoryId, type: this._elementType });
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
        modelId: node.extendedData?.modelId,
        type: this._categoryType,
      });
    }

    if (CategoriesTreeNode.isSubCategoryNode(node)) {
      return this._visibilityHelper.getSubCategoriesVisibilityStatus({
        categoryId: node.extendedData.categoryId,
        subCategoryIds: node.key.instanceKeys.map((instanceKey) => instanceKey.id),
      });
    }

    if (CategoriesTreeNode.isElementNode(node)) {
      return this._visibilityHelper.getElementsVisibilityStatus({
        categoryId: node.extendedData.categoryId,
        modelId: node.extendedData.modelId,
        elementIds: node.key.instanceKeys.map((instanceKey) => instanceKey.id),
        type: this._elementType,
      });
    }

    return of(createVisibilityStatus("disabled"));
  }

  /** Changes visibility of the items represented by the tree node. */
  public changeVisibilityStatusObs(node: HierarchyNode, on: boolean): Observable<void> {
    if (CategoriesTreeNode.isElementClassGroupingNode(node)) {
      const { categoryId, modelElementsMap } = this.getGroupingNodeInfo(node);
      return this._visibilityHelper.changeGroupedElementsVisibilityStatus({ categoryId, modelElementsMap, on });
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
        on,
        modelIds: node.key.instanceKeys.map((instanceKey) => instanceKey.id),
      });
    }

    if (CategoriesTreeNode.isCategoryNode(node)) {
      return this._visibilityHelper.changeCategoriesVisibilityStatus({
        on,
        categoryIds: node.key.instanceKeys.map((instanceKey) => instanceKey.id),
        modelId: node.extendedData?.modelId,
      });
    }

    if (CategoriesTreeNode.isSubCategoryNode(node)) {
      return this._visibilityHelper.changeSubCategoriesVisibilityStatus({
        categoryId: node.extendedData.categoryId,
        subCategoryIds: node.key.instanceKeys.map((instanceKey) => instanceKey.id),
        on,
      });
    }

    if (CategoriesTreeNode.isElementNode(node)) {
      return this._visibilityHelper.changeElementsVisibilityStatus({
        on,
        categoryId: node.extendedData.categoryId,
        modelId: node.extendedData.modelId,
        elementIds: node.key.instanceKeys.map((instanceKey) => instanceKey.id),
      });
    }

    return EMPTY;
  }

  public getFilterTargetsVisibilityStatusObs(targets: CategoriesTreeFilterTargets): Observable<VisibilityStatus> {
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

  private getCategories(props: Parameters<BaseVisibilityStatusHelperProps["getCategories"]>[0]): ReturnType<BaseVisibilityStatusHelperProps["getCategories"]> {
    return from(Id64.iterable(props.modelIds)).pipe(
      mergeMap((modelId) =>
        from(this._props.idsCache.getModelCategoryIds(modelId)).pipe(
          map((categories) => ({ id: modelId, ...(this._props.viewport.view.is2d() ? { drawingCategories: categories } : { spatialCategories: categories }) })),
        ),
      ),
    );
  }

  private getElementsCount(
    props: Parameters<BaseVisibilityStatusHelperProps["getElementsCount"]>[0],
  ): ReturnType<BaseVisibilityStatusHelperProps["getElementsCount"]> {
    return from(this._props.idsCache.getCategoryElementsCount(props.modelId, props.categoryId));
  }

  private getModels(props: Parameters<BaseVisibilityStatusHelperProps["getModels"]>[0]): ReturnType<BaseVisibilityStatusHelperProps["getModels"]> {
    return from(Id64.iterable(props.categoryIds)).pipe(
      mergeMap((categoryId) =>
        from(this._props.idsCache.getCategoriesElementModels(categoryId, true)).pipe(
          mergeMap((categoryModelsMap) => (categoryModelsMap.size > 0 ? categoryModelsMap.values() : of(new Array<ModelId>()))),
          map((categoryModels) => ({ id: categoryId, models: getArrayFromId64Arg(categoryModels) })),
        ),
      ),
    );
  }

  private getSubCategories(
    props: Parameters<BaseVisibilityStatusHelperProps["getSubCategories"]>[0],
  ): ReturnType<BaseVisibilityStatusHelperProps["getSubCategories"]> {
    return from(Id64.iterable(props.categoryIds)).pipe(
      mergeMap((categoryId) =>
        from(this._props.idsCache.getSubCategories(categoryId)).pipe(
          mergeMap((categorySubCategoriesMap) => (categorySubCategoriesMap.size > 0 ? categorySubCategoriesMap.values() : of(new Array<SubCategoryId>()))),
          map((subCategories) => ({ id: categoryId, subCategories })),
        ),
      ),
    );
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

  private getGroupingNodeInfo(
    node: Omit<GroupingHierarchyNode, "key"> & {
      key: ClassGroupingNodeKey;
      extendedData: { categoryId: Id64String; modelElementsMap: Map<ModelId, Set<ElementId>> };
    },
  ) {
    const modelElementsMap: Map<ModelId, Set<ElementId>> = node.extendedData.modelElementsMap;
    const categoryId = node.extendedData?.categoryId;
    return { modelElementsMap, categoryId };
  }
}
