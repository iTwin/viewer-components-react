/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { concat, defer, EMPTY, from, merge, mergeAll, mergeMap, of, Subject } from "rxjs";
import { assert, Guid } from "@itwin/core-bentley";
import { HierarchyNodeKey } from "@itwin/presentation-hierarchies";
import { createVisibilityStatus } from "../../../common/internal/Tooltip.js";
import { HierarchyVisibilityHandlerImpl } from "../../../common/internal/useTreeHooks/UseCachedVisibility.js";
import { fromWithRelease, getParentElementsIdsPath } from "../../../common/internal/Utils.js";
import { mergeVisibilityStatuses } from "../../../common/internal/VisibilityUtils.js";
import { ClassificationsTreeNodeInternal } from "../ClassificationsTreeNodeInternal.js";
import { ClassificationsTreeVisibilityHelper } from "./ClassificationsTreeVisibilityHelper.js";
import { createClassificationsSearchResultsTree } from "./SearchResultsTree.js";

import type { Observable } from "rxjs";
import type { Id64String } from "@itwin/core-bentley";
import type { HierarchyNode, HierarchySearchTree } from "@itwin/presentation-hierarchies";
import type { ECClassHierarchyInspector } from "@itwin/presentation-shared";
import type { AlwaysAndNeverDrawnElementInfoCache } from "../../../common/internal/caches/AlwaysAndNeverDrawnElementInfoCache.js";
import type { SearchResultsTree } from "../../../common/internal/visibility/BaseSearchResultsTree.js";
import type { TreeSpecificVisibilityHandler } from "../../../common/internal/visibility/BaseVisibilityHelper.js";
import type { TreeWidgetViewport } from "../../../common/TreeWidgetViewport.js";
import type { VisibilityStatus } from "../../../common/UseHierarchyVisibility.js";
import type { ClassificationsTreeIdsCache } from "../ClassificationsTreeIdsCache.js";
import type { ClassificationsTreeSearchTargets } from "./SearchResultsTree.js";

/** @internal */
export interface ClassificationsTreeVisibilityHandlerProps {
  idsCache: ClassificationsTreeIdsCache;
  viewport: TreeWidgetViewport;
  alwaysAndNeverDrawnElementInfo: AlwaysAndNeverDrawnElementInfoCache;
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
    this.#visibilityHelper = new ClassificationsTreeVisibilityHelper({
      viewport: this.#props.viewport,
      idsCache: this.#props.idsCache,
      alwaysAndNeverDrawnElementInfo: this.#props.alwaysAndNeverDrawnElementInfo,
      baseIdsCache: this.#props.idsCache,
    });
  }

  public [Symbol.dispose]() {
    this.#visibilityHelper[Symbol.dispose]();
  }

  public changeSearchTargetsVisibilityStatus(targets: ClassificationsTreeSearchTargets, on: boolean): Observable<void> {
    return defer(() => {
      if (this.#props.viewport.viewType !== "3d") {
        return EMPTY;
      }
      const { classificationIds, classificationTableIds, elements } = targets;
      const observables = new Array<Observable<void>>();
      if (classificationTableIds?.size) {
        observables.push(this.#visibilityHelper.changeClassificationTablesVisibilityStatus({ classificationTableIds, on }));
      }

      if (classificationIds?.size) {
        observables.push(this.#visibilityHelper.changeClassificationsVisibilityStatus({ classificationIds, on }));
      }

      if (elements?.length) {
        observables.push(this.changeSearchTargetElementsVisibilityStatus({ elements, on }));
      }

      return merge(...observables);
    });
  }

  private changeSearchTargetElementsVisibilityStatus({
    elements,
    on,
  }: {
    elements: Required<ClassificationsTreeSearchTargets>["elements"];
    on: boolean;
  }): Observable<void> {
    return fromWithRelease({ source: elements, releaseOnCount: 50 }).pipe(
      mergeMap(({ modelId, categoryId, elements: elementsMap, pathToElements, categoryOfTopMostParentElement, topMostParentElementId }) => {
        const parentElementsIdsPath = topMostParentElementId
          ? getParentElementsIdsPath({
              parentInstanceKeys: pathToElements.map((instanceKey) => [instanceKey]),
              topMostParentElementId,
            })
          : [];
        const nonSearchTargetIds = new Array<Id64String>();
        const searchTargetIds = new Array<Id64String>();
        for (const [elementId, { isSearchTarget }] of elementsMap) {
          if (!isSearchTarget) {
            nonSearchTargetIds.push(elementId);
            continue;
          }
          searchTargetIds.push(elementId);
        }
        return merge(
          searchTargetIds.length > 0
            ? this.#visibilityHelper.changeElementsVisibilityStatus({
                modelId,
                categoryId,
                elementIds: searchTargetIds,
                parentElementsIdsPath,
                categoryOfTopMostParentElement,
                on,
              })
            : EMPTY,
          // Child always/never drawn elements will be in search paths, and their visibility status will be handled separately.
          nonSearchTargetIds.length > 0
            ? this.#visibilityHelper.changeElementsVisibilityStatus({
                modelId,
                categoryId,
                elementIds: nonSearchTargetIds,
                on,
                ignoreDescendants: true,
              })
            : EMPTY,
        );
      }),
    );
  }

  public getVisibilityStatus(node: HierarchyNode): Observable<VisibilityStatus> {
    if (this.#props.viewport.viewType !== "3d") {
      return of(createVisibilityStatus("disabled"));
    }
    if (ClassificationsTreeNodeInternal.isClassificationTableNode(node)) {
      return this.#visibilityHelper.getClassificationTablesVisibilityStatus({
        classificationTableIds: node.key.instanceKeys.map((instanceKey) => instanceKey.id),
      });
    }

    if (ClassificationsTreeNodeInternal.isClassificationNode(node)) {
      return this.#visibilityHelper.getClassificationsVisibilityStatus({
        classificationIds: node.key.instanceKeys.map((instanceKey) => instanceKey.id),
      });
    }
    assert(ClassificationsTreeNodeInternal.isGeometricElementNode(node));
    const parentElementsIdsPath = getParentElementsIdsPath({
      parentInstanceKeys: node.parentKeys.filter((parentKey) => HierarchyNodeKey.isInstances(parentKey)).map((parentKey) => parentKey.instanceKeys),
      topMostParentElementId: node.extendedData.topMostParentElementId,
    });
    return this.#visibilityHelper.getElementsVisibilityStatus({
      elementIds: node.key.instanceKeys.map((instanceKey) => instanceKey.id),
      modelId: node.extendedData.modelId,
      categoryId: node.extendedData.categoryId,
      parentElementsIdsPath,
      categoryOfTopMostParentElement: node.extendedData.categoryOfTopMostParentElement,
      computeOnlyOwnStatus: node.children ? undefined : true,
    });
  }

  /** Changes visibility of the items represented by the tree node. */
  public changeVisibilityStatus(node: HierarchyNode, on: boolean): Observable<void> {
    const changeObs = defer(() => {
      if (this.#props.viewport.viewType !== "3d") {
        return EMPTY;
      }
      if (ClassificationsTreeNodeInternal.isClassificationTableNode(node)) {
        return this.#visibilityHelper.changeClassificationTablesVisibilityStatus({
          classificationTableIds: node.key.instanceKeys.map((instanceKey) => instanceKey.id),
          on,
        });
      }

      if (ClassificationsTreeNodeInternal.isClassificationNode(node)) {
        return this.#visibilityHelper.changeClassificationsVisibilityStatus({
          classificationIds: node.key.instanceKeys.map((instanceKey) => instanceKey.id),
          on,
        });
      }
      assert(ClassificationsTreeNodeInternal.isGeometricElementNode(node));
      const elementIds = node.key.instanceKeys.map(({ id }) => id);
      const parentElementsIdsPath = getParentElementsIdsPath({
        parentInstanceKeys: node.parentKeys.filter((parentKey) => HierarchyNodeKey.isInstances(parentKey)).map((parentKey) => parentKey.instanceKeys),
        topMostParentElementId: node.extendedData.topMostParentElementId,
      });

      return this.#visibilityHelper.changeElementsVisibilityStatus({
        elementIds,
        modelId: node.extendedData.modelId,
        categoryId: node.extendedData.categoryId,
        on,
        categoryOfTopMostParentElement: node.extendedData.categoryOfTopMostParentElement,
        parentElementsIdsPath,
      });
    });

    if (this.#props.viewport.isAlwaysDrawnExclusive) {
      return concat(this.#visibilityHelper.removeAlwaysDrawnExclusive(), changeObs);
    }
    return changeObs;
  }

  public getSearchTargetsVisibilityStatus(targets: ClassificationsTreeSearchTargets): Observable<VisibilityStatus> {
    if (this.#props.viewport.viewType !== "3d") {
      return of(createVisibilityStatus("disabled"));
    }
    return defer(() => {
      const { classificationIds, classificationTableIds, elements } = targets;
      const observables = new Array<Observable<VisibilityStatus>>();
      if (classificationTableIds?.size) {
        observables.push(this.#visibilityHelper.getClassificationTablesVisibilityStatus({ classificationTableIds }));
      }

      if (classificationIds?.size) {
        observables.push(this.#visibilityHelper.getClassificationsVisibilityStatus({ classificationIds }));
      }
      if (elements?.length) {
        observables.push(this.getSearchTargetElementsVisibilityStatus({ elements }));
      }

      return from(observables).pipe(mergeAll(), mergeVisibilityStatuses());
    });
  }

  private getSearchTargetElementsVisibilityStatus({
    elements,
  }: {
    elements: Required<ClassificationsTreeSearchTargets>["elements"];
  }): Observable<VisibilityStatus> {
    return fromWithRelease({ source: elements, releaseOnCount: 50 }).pipe(
      mergeMap(({ modelId, categoryId, elements: elementsMap, pathToElements, categoryOfTopMostParentElement, topMostParentElementId }) => {
        const parentElementsIdsPath = topMostParentElementId
          ? getParentElementsIdsPath({
              parentInstanceKeys: pathToElements.map((instanceKey) => [instanceKey]),
              topMostParentElementId,
            })
          : [];
        const nonSearchTargetIds = new Array<Id64String>();
        const searchTargetIds = new Array<Id64String>();
        for (const [elementId, { isSearchTarget }] of elementsMap) {
          if (!isSearchTarget) {
            nonSearchTargetIds.push(elementId);
            continue;
          }
          searchTargetIds.push(elementId);
        }
        return merge(
          searchTargetIds.length > 0
            ? this.#visibilityHelper.getElementsVisibilityStatus({
                modelId,
                categoryId,
                elementIds: searchTargetIds,
                parentElementsIdsPath,
                categoryOfTopMostParentElement,
              })
            : EMPTY,
          // Child always/never drawn elements will be in search paths, and their visibility status will be handled separately.
          nonSearchTargetIds.length > 0
            ? this.#visibilityHelper.getElementsVisibilityStatus({
                modelId,
                categoryId,
                elementIds: nonSearchTargetIds,
                computeOnlyOwnStatus: true,
              })
            : EMPTY,
        );
      }),
    );
  }
}

/**
 * Creates classifications tree visibility handler. Is used by integration and performance tests.
 * @internal
 */
export function createClassificationsTreeVisibilityHandler(props: {
  viewport: TreeWidgetViewport;
  idsCache: ClassificationsTreeIdsCache;
  imodelAccess: ECClassHierarchyInspector;
  searchPaths?: HierarchySearchTree[];
}) {
  return new HierarchyVisibilityHandlerImpl<ClassificationsTreeSearchTargets>({
    cancelChangesInProgress: new Subject<void>(),
    getSearchResultsTree: (): undefined | Promise<SearchResultsTree<ClassificationsTreeSearchTargets>> => {
      if (!props.searchPaths) {
        return undefined;
      }
      return createClassificationsSearchResultsTree({
        idsCache: props.idsCache,
        searchPaths: props.searchPaths,
        imodelAccess: props.imodelAccess,
      });
    },
    getTreeSpecificVisibilityHandler: ({ info, viewport }) => {
      return new ClassificationsTreeVisibilityHandler({
        alwaysAndNeverDrawnElementInfo: info,
        idsCache: props.idsCache,
        viewport,
      });
    },
    viewport: props.viewport,
    componentId: Guid.createValue(),
  });
}
