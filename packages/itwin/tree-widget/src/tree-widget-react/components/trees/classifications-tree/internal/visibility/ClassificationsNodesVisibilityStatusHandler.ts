/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { defer, EMPTY, from, map, merge, mergeMap, of, toArray } from "rxjs";
import { Id64 } from "@itwin/core-bentley";
import { HierarchyNode } from "@itwin/presentation-hierarchies";
import { getArrayFromId64Arg, releaseMainThreadOnItemsCount } from "../../../common/internal/Utils.js";
import { mergeVisibilityStatuses } from "../../../common/internal/VisibilityUtils.js";
import { ClassificationsTreeNode } from "./ClassificationsTreeNode.js";
import { ClassificationsVisibilityStatusHelper } from "./ClassificationsVisibilityHelper.js";

import type { Viewport } from "@itwin/core-frontend";
import type { AlwaysAndNeverDrawnElementInfo } from "../../../common/internal/AlwaysAndNeverDrawnElementInfo.js";
import type { BaseVisibilityStatusHelperProps } from "../../../common/internal/visibility/BaseVisibilityStatusHelper.js";
import type { NodesVisibilityStatusHandler } from "../../../common/internal/visibility/TreeVisibilityHandler.js";
import type { Observable } from "rxjs";
import type { ModelId } from "../../../common/internal/Types.js";
import type { VisibilityStatus } from "../../../common/UseHierarchyVisibility.js";
import type { ClassificationsTreeIdsCache } from "../ClassificationsTreeIdsCache.js";
import type { ClassificationsTreeFilterTargets } from "./FilteredTree.js";

/**
 * @internal
 */
export interface ClassificationsNodesVisibilityStatusHandlerProps {
  idsCache: ClassificationsTreeIdsCache;
  viewport: Viewport;
  alwaysAndNeverDrawnElementInfo: AlwaysAndNeverDrawnElementInfo;
}

/**
 * @internal
 */
export class ClassificationsNodesVisibilityStatusHandler implements Disposable, NodesVisibilityStatusHandler<ClassificationsTreeFilterTargets> {
  private _visibilityHelper: ClassificationsVisibilityStatusHelper;

  constructor(private readonly _props: ClassificationsNodesVisibilityStatusHandlerProps) {
    this._visibilityHelper = new ClassificationsVisibilityStatusHelper({
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

  public changeFilterTargetsVisibilityStatusObs(targets: ClassificationsTreeFilterTargets, on: boolean): Observable<void> {
    return defer(() => {
      const { classificationIds, classificationTableIds, elements2d, elements3d } = targets;
      const observables = new Array<Observable<void>>();
      if (classificationTableIds?.size) {
        observables.push(this._visibilityHelper.changeClassificationTablesVisibilityStatus({ classificationTableIds, on }));
      }

      if (classificationIds?.size) {
        observables.push(this._visibilityHelper.changeClassificationsVisibilityStatus({ classificationIds, on }));
      }

      if (elements2d?.length) {
        observables.push(
          from(elements2d).pipe(
            mergeMap(({ modelId, categoryId, elementIds }) => this._visibilityHelper.changeElementsVisibilityStatus({ modelId, categoryId, elementIds, on })),
          ),
        );
      }

      if (elements3d?.length) {
        observables.push(
          from(elements3d).pipe(
            mergeMap(({ modelId, categoryId, elementIds }) => this._visibilityHelper.changeElementsVisibilityStatus({ modelId, categoryId, elementIds, on })),
          ),
        );
      }

      return merge(...observables);
    });
  }

  public getVisibilityStatusObs(node: HierarchyNode): Observable<VisibilityStatus> {
    if (!HierarchyNode.isInstancesNode(node)) {
      return EMPTY;
    }

    if (ClassificationsTreeNode.isClassificationTableNode(node)) {
      return this._visibilityHelper.getClassificationTablesVisibilityStatus({
        classificationTableIds: node.key.instanceKeys.map((instanceKey) => instanceKey.id),
      });
    }

    if (ClassificationsTreeNode.isClassificationNode(node)) {
      return this._visibilityHelper.getClassificationsVisibilityStatus({
        classificationIds: node.key.instanceKeys.map((instanceKey) => instanceKey.id),
      });
    }

    return this._visibilityHelper.getElementsVisibilityStatus({
      elementIds: node.key.instanceKeys.map((instanceKey) => instanceKey.id),
      modelId: ClassificationsTreeNode.getModelId(node),
      categoryId: ClassificationsTreeNode.getCategoryId(node),
      type: node.extendedData?.type,
    });
  }

  /** Changes visibility of the items represented by the tree node. */
  public changeVisibilityStatusObs(node: HierarchyNode, on: boolean): Observable<void> {
    if (!HierarchyNode.isInstancesNode(node)) {
      return EMPTY;
    }

    if (ClassificationsTreeNode.isClassificationTableNode(node)) {
      return this._visibilityHelper.changeClassificationTablesVisibilityStatus({
        classificationTableIds: node.key.instanceKeys.map((instanceKey) => instanceKey.id),
        on,
      });
    }

    if (ClassificationsTreeNode.isClassificationNode(node)) {
      return this._visibilityHelper.changeClassificationsVisibilityStatus({
        classificationIds: node.key.instanceKeys.map((instanceKey) => instanceKey.id),
        on,
      });
    }

    return this._visibilityHelper.changeElementsVisibilityStatus({
      elementIds: node.key.instanceKeys.map(({ id }) => id),
      modelId: ClassificationsTreeNode.getModelId(node),
      categoryId: ClassificationsTreeNode.getCategoryId(node),
      on,
    });
  }

  public getFilterTargetsVisibilityStatusObs(targets: ClassificationsTreeFilterTargets): Observable<VisibilityStatus> {
    return defer(() => {
      const { classificationIds, classificationTableIds, elements2d, elements3d } = targets;
      const observables = new Array<Observable<VisibilityStatus>>();
      if (classificationTableIds?.size) {
        observables.push(this._visibilityHelper.getClassificationTablesVisibilityStatus({ classificationTableIds }));
      }

      if (classificationIds?.size) {
        observables.push(this._visibilityHelper.getClassificationsVisibilityStatus({ classificationIds }));
      }
      if (elements2d?.length) {
        observables.push(
          from(elements2d).pipe(
            releaseMainThreadOnItemsCount(50),
            mergeMap(({ modelId, categoryId, elementIds }) => {
              return from(elementIds).pipe(
                releaseMainThreadOnItemsCount(1000),
                mergeMap((elementId) =>
                  this._visibilityHelper.getElementsVisibilityStatus({ modelId, categoryId, elementIds: elementId, type: "GeometricElement2d" }),
                ),
              );
            }),
          ),
        );
      }

      if (elements3d?.length) {
        observables.push(
          from(elements3d).pipe(
            releaseMainThreadOnItemsCount(50),
            mergeMap(({ modelId, categoryId, elementIds }) => {
              return from(elementIds).pipe(
                releaseMainThreadOnItemsCount(1000),
                mergeMap((elementId) =>
                  this._visibilityHelper.getElementsVisibilityStatus({ modelId, categoryId, elementIds: elementId, type: "GeometricElement3d" }),
                ),
              );
            }),
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
          map(({ spatial, drawing }) => ({ id: modelId, drawingCategories: drawing, spatialCategories: spatial })),
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
    return from(Id64.iterable(props.categoryIds)).pipe(map((categoryId) => ({ id: categoryId, subCategories: [] })));
  }

  private getSubModels(props: Parameters<BaseVisibilityStatusHelperProps["getSubModels"]>[0]): ReturnType<BaseVisibilityStatusHelperProps["getSubModels"]> {
    if ("modelIds" in props) {
      return from(Id64.iterable(props.modelIds)).pipe(
        mergeMap((modelId) =>
          from(this._props.idsCache.getModelCategoryIds(modelId)).pipe(
            mergeMap(({ drawing, spatial }) => merge(drawing, spatial)),
            toArray(),
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
}
