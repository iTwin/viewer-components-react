/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { concat, defer, EMPTY, from, map, merge, mergeMap, of, toArray } from "rxjs";
import { Id64 } from "@itwin/core-bentley";
import { HierarchyNode } from "@itwin/presentation-hierarchies";
import { fromWithRelease } from "../../../common/internal/Utils.js";
import { mergeVisibilityStatuses } from "../../../common/internal/VisibilityUtils.js";
import { ClassificationsTreeNode } from "../ClassificationsTreeNode.js";
import { ClassificationsTreeVisibilityHelper } from "./ClassificationsTreeVisibilityHelper.js";

import type { Observable } from "rxjs";
import type { AlwaysAndNeverDrawnElementInfo } from "../../../common/internal/AlwaysAndNeverDrawnElementInfo.js";
import type { BaseIdsCache, TreeSpecificVisibilityHandler } from "../../../common/internal/visibility/BaseVisibilityHelper.js";
import type { TreeWidgetViewport } from "../../../common/TreeWidgetViewport.js";
import type { VisibilityStatus } from "../../../common/UseHierarchyVisibility.js";
import type { ClassificationsTreeIdsCache } from "../ClassificationsTreeIdsCache.js";
import type { ClassificationsTreeSearchTargets } from "./SearchResultsTree.js";

/** @internal */
export interface ClassificationsTreeVisibilityHandlerProps {
  idsCache: ClassificationsTreeIdsCache;
  viewport: TreeWidgetViewport;
  alwaysAndNeverDrawnElementInfo: AlwaysAndNeverDrawnElementInfo;
}

/**
 * Handles visibility status of classifications tree nodes.
 *
 * This handler knows how to get and change visibility status of nodes created by hierarchy definition.
 * @internal
 */
export class ClassificationsTreeVisibilityHandler implements Disposable, TreeSpecificVisibilityHandler<ClassificationsTreeSearchTargets> {
  readonly #props: ClassificationsTreeVisibilityHandlerProps;
  #visibilityHelper: ClassificationsTreeVisibilityHelper;

  constructor(constructorProps: ClassificationsTreeVisibilityHandlerProps) {
    this.#props = constructorProps;
    // Remove after https://github.com/iTwin/viewer-components-react/issues/1421.
    // We won't need to create a custom base ids cache.
    const baseIdsCache: BaseIdsCache = {
      getCategories: (props) => this.getCategories(props),
      getAllCategories: () => this.getAllCategories(),
      getElementsCount: (props) => this.getElementsCount(props),
      getModels: (props) => this.getModels(props),
      getSubCategories: (props) => this.getSubCategories(props),
      getSubModels: (props) => this.getSubModels(props),
      hasSubModel: (props) => this.#props.idsCache.hasSubModel(props),
    };
    this.#visibilityHelper = new ClassificationsTreeVisibilityHelper({
      viewport: this.#props.viewport,
      idsCache: this.#props.idsCache,
      alwaysAndNeverDrawnElementInfo: this.#props.alwaysAndNeverDrawnElementInfo,
      baseIdsCache,
    });
  }

  public [Symbol.dispose]() {
    this.#visibilityHelper[Symbol.dispose]();
  }

  public changeSearchTargetsVisibilityStatus(targets: ClassificationsTreeSearchTargets, on: boolean): Observable<void> {
    return defer(() => {
      const { classificationIds, classificationTableIds, elements2d, elements3d } = targets;
      const observables = new Array<Observable<void>>();
      if (classificationTableIds?.size) {
        observables.push(this.#visibilityHelper.changeClassificationTablesVisibilityStatus({ classificationTableIds, on }));
      }

      if (classificationIds?.size) {
        observables.push(this.#visibilityHelper.changeClassificationsVisibilityStatus({ classificationIds, on }));
      }

      if (elements2d?.length) {
        observables.push(
          from(elements2d).pipe(
            mergeMap(({ modelId, categoryId, elements }) =>
              this.#visibilityHelper.changeElementsVisibilityStatus({ modelId, categoryId, elementIds: [...elements.keys()], on }),
            ),
          ),
        );
      }

      if (elements3d?.length) {
        observables.push(
          from(elements3d).pipe(
            mergeMap(({ modelId, categoryId, elements }) =>
              this.#visibilityHelper.changeElementsVisibilityStatus({ modelId, categoryId, elementIds: [...elements.keys()], on }),
            ),
          ),
        );
      }

      return merge(...observables);
    });
  }

  public getVisibilityStatus(node: HierarchyNode): Observable<VisibilityStatus> {
    if (!HierarchyNode.isInstancesNode(node)) {
      return EMPTY;
    }

    if (ClassificationsTreeNode.isClassificationTableNode(node)) {
      return this.#visibilityHelper.getClassificationTablesVisibilityStatus({
        classificationTableIds: node.key.instanceKeys.map((instanceKey) => instanceKey.id),
      });
    }

    if (ClassificationsTreeNode.isClassificationNode(node)) {
      return this.#visibilityHelper.getClassificationsVisibilityStatus({
        classificationIds: node.key.instanceKeys.map((instanceKey) => instanceKey.id),
      });
    }

    return this.#visibilityHelper.getElementsVisibilityStatus({
      elementIds: node.key.instanceKeys.map((instanceKey) => instanceKey.id),
      modelId: ClassificationsTreeNode.getModelId(node),
      categoryId: ClassificationsTreeNode.getCategoryId(node),
      type: node.extendedData?.type,
    });
  }

  /** Changes visibility of the items represented by the tree node. */
  public changeVisibilityStatus(node: HierarchyNode, on: boolean): Observable<void> {
    const changeObs = defer(() => {
      if (!HierarchyNode.isInstancesNode(node)) {
        return EMPTY;
      }

      if (ClassificationsTreeNode.isClassificationTableNode(node)) {
        return this.#visibilityHelper.changeClassificationTablesVisibilityStatus({
          classificationTableIds: node.key.instanceKeys.map((instanceKey) => instanceKey.id),
          on,
        });
      }

      if (ClassificationsTreeNode.isClassificationNode(node)) {
        return this.#visibilityHelper.changeClassificationsVisibilityStatus({
          classificationIds: node.key.instanceKeys.map((instanceKey) => instanceKey.id),
          on,
        });
      }

      return this.#visibilityHelper.changeElementsVisibilityStatus({
        elementIds: node.key.instanceKeys.map(({ id }) => id),
        modelId: ClassificationsTreeNode.getModelId(node),
        categoryId: ClassificationsTreeNode.getCategoryId(node),
        on,
      });
    });
    if (this.#props.viewport.isAlwaysDrawnExclusive) {
      return concat(this.#visibilityHelper.removeAlwaysDrawnExclusive(), changeObs);
    }
    return changeObs;
  }

  public getSearchTargetsVisibilityStatus(targets: ClassificationsTreeSearchTargets): Observable<VisibilityStatus> {
    return defer(() => {
      const { classificationIds, classificationTableIds, elements2d, elements3d } = targets;
      const observables = new Array<Observable<VisibilityStatus>>();
      if (classificationTableIds?.size) {
        observables.push(this.#visibilityHelper.getClassificationTablesVisibilityStatus({ classificationTableIds }));
      }

      if (classificationIds?.size) {
        observables.push(this.#visibilityHelper.getClassificationsVisibilityStatus({ classificationIds }));
      }
      if (elements2d?.length) {
        observables.push(
          fromWithRelease({ source: elements2d, releaseOnCount: 50 }).pipe(
            mergeMap(({ modelId, categoryId, elements }) => {
              return fromWithRelease({ source: [...elements.keys()], releaseOnCount: 1000 }).pipe(
                mergeMap((elementId) =>
                  this.#visibilityHelper.getElementsVisibilityStatus({ modelId, categoryId, elementIds: elementId, type: "GeometricElement2d" }),
                ),
              );
            }),
          ),
        );
      }

      if (elements3d?.length) {
        observables.push(
          fromWithRelease({ source: elements3d, releaseOnCount: 50 }).pipe(
            mergeMap(({ modelId, categoryId, elements }) => {
              return fromWithRelease({ source: [...elements.keys()], releaseOnCount: 1000 }).pipe(
                mergeMap((elementId) =>
                  this.#visibilityHelper.getElementsVisibilityStatus({ modelId, categoryId, elementIds: elementId, type: "GeometricElement3d" }),
                ),
              );
            }),
          ),
        );
      }

      return merge(...observables);
    }).pipe(mergeVisibilityStatuses);
  }

  private getCategories(props: Parameters<BaseIdsCache["getCategories"]>[0]): ReturnType<BaseIdsCache["getCategories"]> {
    return from(Id64.iterable(props.modelIds)).pipe(
      mergeMap((modelId) =>
        this.#props.idsCache
          .getModelCategoryIds(modelId)
          .pipe(map(({ spatial, drawing }) => ({ id: modelId, drawingCategories: drawing, spatialCategories: spatial }))),
      ),
    );
  }

  private getAllCategories(): ReturnType<BaseIdsCache["getAllCategories"]> {
    return this.#props.idsCache.getAllCategories().pipe(
      map(({ drawing, spatial }) => {
        return { drawingCategories: drawing, spatialCategories: spatial };
      }),
    );
  }

  private getElementsCount(props: Parameters<BaseIdsCache["getElementsCount"]>[0]): ReturnType<BaseIdsCache["getElementsCount"]> {
    return this.#props.idsCache.getCategoryElementsCount(props.modelId, props.categoryId);
  }

  private getModels(props: Parameters<BaseIdsCache["getModels"]>[0]): ReturnType<BaseIdsCache["getModels"]> {
    return this.#props.idsCache.getCategoriesElementModels(props.categoryIds, true);
  }

  private getSubCategories(props: Parameters<BaseIdsCache["getSubCategories"]>[0]): ReturnType<BaseIdsCache["getSubCategories"]> {
    return this.#props.idsCache.getSubCategories(props.categoryId);
  }

  private getSubModels(props: Parameters<BaseIdsCache["getSubModels"]>[0]): ReturnType<BaseIdsCache["getSubModels"]> {
    if ("modelIds" in props) {
      return from(Id64.iterable(props.modelIds)).pipe(
        mergeMap((modelId) => {
          if (props.categoryId) {
            return this.#props.idsCache.getCategoriesModeledElements(modelId, props.categoryId).pipe(map((subModels) => ({ id: modelId, subModels })));
          }
          return from(this.#props.idsCache.getModelCategoryIds(modelId)).pipe(
            mergeMap(({ drawing, spatial }) => merge(drawing, spatial)),
            toArray(),
            mergeMap((categoryIds) => this.#props.idsCache.getCategoriesModeledElements(modelId, categoryIds)),
            map((subModels) => ({ id: modelId, subModels })),
          );
        }),
      );
    }

    if (props.modelId) {
      return from(Id64.iterable(props.categoryIds)).pipe(
        mergeMap((categoryId) =>
          this.#props.idsCache.getCategoriesModeledElements(props.modelId!, categoryId).pipe(map((subModels) => ({ id: categoryId, subModels }))),
        ),
      );
    }

    return this.#props.idsCache.getCategoriesElementModels(props.categoryIds).pipe(
      mergeMap(({ id, models }) => {
        if (!models) {
          return of({ id, subModels: undefined });
        }
        return from(models).pipe(
          mergeMap((modelId) => this.#props.idsCache.getCategoriesModeledElements(modelId, id)),
          map((subModels) => ({ id, subModels })),
        );
      }),
    );
  }
}
