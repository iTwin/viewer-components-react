/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { defer, EMPTY, from, map, merge, mergeMap, of, toArray } from "rxjs";
import { Id64 } from "@itwin/core-bentley";
import { HierarchyNode } from "@itwin/presentation-hierarchies";
import { releaseMainThreadOnItemsCount } from "../../../common/internal/Utils.js";
import { mergeVisibilityStatuses } from "../../../common/internal/VisibilityUtils.js";
import { ClassificationsTreeNode } from "../ClassificationsTreeNode.js";
import { ClassificationsTreeVisibilityStatusGetter } from "./ClassificationsTreeVisibilityStatusGetter.js";
import { ClassificationsTreeVisibilityStatusModifier } from "./ClassificationsTreeVisibilityStatusModifier.js";

import type { Observable } from "rxjs";
import type { Viewport } from "@itwin/core-frontend";
import type { AlwaysAndNeverDrawnElementInfo } from "../../../common/internal/AlwaysAndNeverDrawnElementInfo.js";
import type { TreeNodesVisibilityStatusHandler, VisibilityStatusHelper } from "../../../common/internal/visibility/TreeVisibilityHandler.js";
import type { ModelId } from "../../../common/internal/Types.js";
import type { HierarchyVisibilityHandler, VisibilityStatus } from "../../../common/UseHierarchyVisibility.js";
import type { ClassificationsTreeIdsCache } from "../ClassificationsTreeIdsCache.js";
import type { ClassificationsTreeFilterTargets } from "./FilteredTree.js";

/** @internal */
export interface ClassificationsTreeNodesVisibilityStatusHandlerProps {
  idsCache: ClassificationsTreeIdsCache;
  viewport: Viewport;
  alwaysAndNeverDrawnElementInfo: AlwaysAndNeverDrawnElementInfo;
  visibilityHandler: HierarchyVisibilityHandler;
}

/**
 * Handles visibility status of classifications tree nodes.
 *
 * This handler knows how to get and change visibility status of nodes created by hierarchy definition.
 * @internal
 */
export class ClassificationsTreeNodesVisibilityStatusHandler implements Disposable, TreeNodesVisibilityStatusHandler<ClassificationsTreeFilterTargets> {
  private _visibilityGetter: ClassificationsTreeVisibilityStatusGetter;
  private _visibilityModifier: ClassificationsTreeVisibilityStatusModifier;

  constructor(private readonly _props: ClassificationsTreeNodesVisibilityStatusHandlerProps) {
    const visibilityStatusHelper: VisibilityStatusHelper = {
      getCategories: (props) => this.getCategories(props),
      getElementsCount: (props) => this.getElementsCount(props),
      getModels: (props) => this.getModels(props),
      getSubCategories: (props) => this.getSubCategories(props),
      getSubModels: (props) => this.getSubModels(props),
      hasSubModel: async (props) => this._props.idsCache.hasSubModel(props),
    };
    this._visibilityGetter = new ClassificationsTreeVisibilityStatusGetter({
      viewport: this._props.viewport,
      idsCache: this._props.idsCache,
      alwaysAndNeverDrawnElementInfo: this._props.alwaysAndNeverDrawnElementInfo,
      visibilityHandler: this._props.visibilityHandler,
      visibilityStatusHelper,
    });
    this._visibilityModifier = new ClassificationsTreeVisibilityStatusModifier({
      viewport: this._props.viewport,
      idsCache: this._props.idsCache,
      alwaysAndNeverDrawnElementInfo: this._props.alwaysAndNeverDrawnElementInfo,
      visibilityHandler: this._props.visibilityHandler,
      visibilityStatusHelper,
      visibilityStatusGetter: this._visibilityGetter,
    });
  }

  public [Symbol.dispose]() {
    this._visibilityModifier[Symbol.dispose]();
  }

  public changeFilterTargetsVisibilityStatusObs(targets: ClassificationsTreeFilterTargets, on: boolean): Observable<void> {
    return defer(() => {
      const { classificationIds, classificationTableIds, elements2d, elements3d } = targets;
      const observables = new Array<Observable<void>>();
      if (classificationTableIds?.size) {
        observables.push(this._visibilityModifier.changeClassificationTablesVisibilityStatus({ classificationTableIds, on }));
      }

      if (classificationIds?.size) {
        observables.push(this._visibilityModifier.changeClassificationsVisibilityStatus({ classificationIds, on }));
      }

      if (elements2d?.length) {
        observables.push(
          from(elements2d).pipe(
            mergeMap(({ modelId, categoryId, elementIds }) => this._visibilityModifier.changeElementsVisibilityStatus({ modelId, categoryId, elementIds, on })),
          ),
        );
      }

      if (elements3d?.length) {
        observables.push(
          from(elements3d).pipe(
            mergeMap(({ modelId, categoryId, elementIds }) => this._visibilityModifier.changeElementsVisibilityStatus({ modelId, categoryId, elementIds, on })),
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
      return this._visibilityGetter.getClassificationTablesVisibilityStatus({
        classificationTableIds: node.key.instanceKeys.map((instanceKey) => instanceKey.id),
      });
    }

    if (ClassificationsTreeNode.isClassificationNode(node)) {
      return this._visibilityGetter.getClassificationsVisibilityStatus({
        classificationIds: node.key.instanceKeys.map((instanceKey) => instanceKey.id),
      });
    }

    return this._visibilityGetter.getElementsVisibilityStatus({
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
      return this._visibilityModifier.changeClassificationTablesVisibilityStatus({
        classificationTableIds: node.key.instanceKeys.map((instanceKey) => instanceKey.id),
        on,
      });
    }

    if (ClassificationsTreeNode.isClassificationNode(node)) {
      return this._visibilityModifier.changeClassificationsVisibilityStatus({
        classificationIds: node.key.instanceKeys.map((instanceKey) => instanceKey.id),
        on,
      });
    }

    return this._visibilityModifier.changeElementsVisibilityStatus({
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
        observables.push(this._visibilityGetter.getClassificationTablesVisibilityStatus({ classificationTableIds }));
      }

      if (classificationIds?.size) {
        observables.push(this._visibilityGetter.getClassificationsVisibilityStatus({ classificationIds }));
      }
      if (elements2d?.length) {
        observables.push(
          from(elements2d).pipe(
            releaseMainThreadOnItemsCount(50),
            mergeMap(({ modelId, categoryId, elementIds }) => {
              return from(elementIds).pipe(
                releaseMainThreadOnItemsCount(1000),
                mergeMap((elementId) =>
                  this._visibilityGetter.getElementsVisibilityStatus({ modelId, categoryId, elementIds: elementId, type: "GeometricElement2d" }),
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
                  this._visibilityGetter.getElementsVisibilityStatus({ modelId, categoryId, elementIds: elementId, type: "GeometricElement3d" }),
                ),
              );
            }),
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
          map(({ spatial, drawing }) => ({ id: modelId, drawingCategories: drawing, spatialCategories: spatial })),
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
          mergeMap((categoryModelsMap) => (categoryModelsMap.size > 0 ? categoryModelsMap.values() : of(new Array<ModelId>()))),
          map((categoryModels) => ({ id: categoryId, models: categoryModels })),
        ),
      ),
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
}
