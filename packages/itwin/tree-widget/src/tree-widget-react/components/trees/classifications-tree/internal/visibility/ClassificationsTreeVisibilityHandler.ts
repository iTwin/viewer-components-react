/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { concat, defer, EMPTY, from, merge, mergeMap } from "rxjs";
import { HierarchyNode } from "@itwin/presentation-hierarchies";
import { releaseMainThreadOnItemsCount } from "../../../common/internal/Utils.js";
import { mergeVisibilityStatuses } from "../../../common/internal/VisibilityUtils.js";
import { ClassificationsTreeNode } from "../ClassificationsTreeNode.js";
import { ClassificationsTreeVisibilityHelper } from "./ClassificationsTreeVisibilityHelper.js";

import type { Observable } from "rxjs";
import type { AlwaysAndNeverDrawnElementInfo } from "../../../common/internal/AlwaysAndNeverDrawnElementInfo.js";
import type { TreeSpecificVisibilityHandler } from "../../../common/internal/visibility/BaseVisibilityHelper.js";
import type { TreeWidgetViewport } from "../../../common/TreeWidgetViewport.js";
import type { VisibilityStatus } from "../../../common/UseHierarchyVisibility.js";
import type { ClassificationsTreeIdsCache } from "../ClassificationsTreeIdsCache.js";
import type { ClassificationsTreeFilterTargets } from "./FilteredTree.js";

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
export class ClassificationsTreeVisibilityHandler implements Disposable, TreeSpecificVisibilityHandler<ClassificationsTreeFilterTargets> {
  readonly #props: ClassificationsTreeVisibilityHandlerProps;
  #visibilityHelper: ClassificationsTreeVisibilityHelper;

  constructor(constructorProps: ClassificationsTreeVisibilityHandlerProps) {
    this.#props = constructorProps;
    this.#visibilityHelper = new ClassificationsTreeVisibilityHelper({
      viewport: this.#props.viewport,
      idsCache: this.#props.idsCache,
      alwaysAndNeverDrawnElementInfo: this.#props.alwaysAndNeverDrawnElementInfo,
    });
  }

  public [Symbol.dispose]() {
    this.#visibilityHelper[Symbol.dispose]();
  }

  public changeFilterTargetsVisibilityStatus(targets: ClassificationsTreeFilterTargets, on: boolean): Observable<void> {
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
            mergeMap(({ modelId, categoryId, elementIds }) => this.#visibilityHelper.changeElementsVisibilityStatus({ modelId, categoryId, elementIds, on })),
          ),
        );
      }

      if (elements3d?.length) {
        observables.push(
          from(elements3d).pipe(
            mergeMap(({ modelId, categoryId, elementIds }) => this.#visibilityHelper.changeElementsVisibilityStatus({ modelId, categoryId, elementIds, on })),
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

  public getFilterTargetsVisibilityStatus(targets: ClassificationsTreeFilterTargets): Observable<VisibilityStatus> {
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
          from(elements2d).pipe(
            releaseMainThreadOnItemsCount(50),
            mergeMap(({ modelId, categoryId, elementIds }) => {
              return from(elementIds).pipe(
                releaseMainThreadOnItemsCount(1000),
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
          from(elements3d).pipe(
            releaseMainThreadOnItemsCount(50),
            mergeMap(({ modelId, categoryId, elementIds }) => {
              return from(elementIds).pipe(
                releaseMainThreadOnItemsCount(1000),
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
}
