/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { concat, defer, EMPTY, from, map, merge, mergeAll, mergeMap, of } from "rxjs";
import { assert } from "@itwin/core-bentley";
import { HierarchyNodeKey } from "@itwin/presentation-hierarchies";
import { createVisibilityStatus } from "../../../common/internal/Tooltip.js";
import { fromWithRelease, getIdsFromChildrenTree, getParentElementsIdsPath, setDifference, setIntersection } from "../../../common/internal/Utils.js";
import { mergeVisibilityStatuses } from "../../../common/internal/VisibilityUtils.js";
import { ClassificationsTreeNodeInternal } from "../ClassificationsTreeNodeInternal.js";
import { ClassificationsTreeVisibilityHelper } from "./ClassificationsTreeVisibilityHelper.js";

import type { Observable } from "rxjs";
import type { Id64Set, Id64String } from "@itwin/core-bentley";
import type { HierarchyNode } from "@itwin/presentation-hierarchies";
import type { AlwaysAndNeverDrawnElementInfoCache } from "../../../common/internal/caches/AlwaysAndNeverDrawnElementInfoCache.js";
import type { CategoryId, ElementId, ModelId } from "../../../common/internal/Types.js";
import type { ChildrenTree } from "../../../common/internal/Utils.js";
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
    const searchTargetElements = new Array<Id64String>();
    const elementIdsSet = new Set<Id64String>();
    const modelCategoryElementMap = new Map<`${ModelId}-${CategoryId}`, Array<ElementId>>();
    // elements is an array that stores elements grouped by:
    // 1. Their path
    // 2. Their modelId and categoryId
    // When changing visibility of elements, visibility handler does not care about the path.
    // So we can first get all elements and group them only by modelId and categoryId.
    for (const { elements: elementsMap, categoryId, modelId } of elements) {
      const key: `${ModelId}-${CategoryId}` = `${modelId}-${categoryId}`;
      let mapEntry = modelCategoryElementMap.get(key);
      if (!mapEntry) {
        mapEntry = [];
        modelCategoryElementMap.set(key, mapEntry);
      }
      for (const [elementId, { isSearchTarget }] of elementsMap) {
        mapEntry.push(elementId);
        elementIdsSet.add(elementId);
        if (isSearchTarget) {
          searchTargetElements.push(elementId);
        }
      }
    }
    // Get children for search targets, since non search targets don't have all the children present in the hierarchy.
    return this.#props.idsCache.getChildElementsTree({ elementIds: searchTargetElements }).pipe(
      // Need to filter out and keep only those children ids that are not part of elements that are present in search paths.
      // Elements in search paths will have their visibility changed directly: they will be provided as elementIds to changeElementsVisibilityStatus.
      map((childrenTree) => ({
        childrenNotInSearchPaths: setDifference(getIdsFromChildrenTree({ tree: childrenTree, predicate: ({ depth }) => depth > 0 }), elementIdsSet),
        childrenTree,
      })),
      mergeMap(({ childrenNotInSearchPaths, childrenTree }) =>
        fromWithRelease({ source: modelCategoryElementMap.entries(), size: modelCategoryElementMap.size, releaseOnCount: 50 }).pipe(
          mergeMap(([key, elementsInSearchPathsGroupedByModelAndCategory]) => {
            const [modelId, categoryId] = key.split("-");
            const childrenIds = new Set<Id64String>();
            // A shared children tree was created, need to get the children for each element in the group.
            for (const elementId of elementsInSearchPathsGroupedByModelAndCategory) {
              const elementChildrenTree: ChildrenTree | undefined = childrenTree.get(elementId)?.children;
              if (!elementChildrenTree) {
                continue;
              }
              for (const childId of getIdsFromChildrenTree({ tree: elementChildrenTree })) {
                childrenIds.add(childId);
              }
            }
            return this.#visibilityHelper.changeElementsVisibilityStatus({
              modelId,
              categoryId,
              elementIds: elementsInSearchPathsGroupedByModelAndCategory,
              // Pass only those children that are not part of search paths.
              children: setIntersection(childrenIds, childrenNotInSearchPaths),
              on,
            });
          }),
        ),
      ),
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
      childrenCount: node.extendedData.childrenCount,
      categoryOfTopMostParentElement: node.extendedData.categoryOfTopMostParentElement,
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
      return this.#props.idsCache.getChildElementsTree({ elementIds }).pipe(
        map((childrenTree): Id64Set => {
          // Children tree contains provided elementIds, they are at the root of this tree.
          // We want to skip them and only get ids of children.
          return getIdsFromChildrenTree({ tree: childrenTree, predicate: ({ depth }) => depth > 0 });
        }),
        mergeMap((children) =>
          this.#visibilityHelper.changeElementsVisibilityStatus({
            elementIds,
            modelId: node.extendedData.modelId,
            categoryId: node.extendedData.categoryId,
            children: children.size > 0 ? children : undefined,
            on,
          }),
        ),
      );
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
    const searchTargetElements = new Array<Id64String>();
    for (const { elements: elementsMap } of elements) {
      for (const [elementId, { isSearchTarget }] of elementsMap) {
        if (isSearchTarget) {
          searchTargetElements.push(elementId);
        }
      }
    }
    return this.#props.idsCache.getAllChildElementsCount({ elementIds: searchTargetElements }).pipe(
      mergeMap((elementsChildrenCountMap) =>
        fromWithRelease({ source: elements, releaseOnCount: 50 }).pipe(
          mergeMap(({ modelId, categoryId, elements: elementsMap, pathToElements, categoryOfTopMostParentElement, topMostParentElementId }) => {
            const parentElementsIdsPath = topMostParentElementId
              ? getParentElementsIdsPath({
                  parentInstanceKeys: pathToElements.map((instanceKey) => [instanceKey]),
                  topMostParentElementId,
                })
              : [];
            let totalSearchTargetsChildrenCount = 0;
            const nonSearchTargetIds = new Array<Id64String>();
            const searchTargetIds = new Array<Id64String>();
            for (const [elementId, { isSearchTarget }] of elementsMap) {
              if (!isSearchTarget) {
                nonSearchTargetIds.push(elementId);
                continue;
              }
              searchTargetIds.push(elementId);
              const childCount = elementsChildrenCountMap.get(elementId);
              if (childCount) {
                totalSearchTargetsChildrenCount += childCount;
              }
            }
            return merge(
              searchTargetIds.length > 0
                ? this.#visibilityHelper.getElementsVisibilityStatus({
                    modelId,
                    categoryId,
                    elementIds: searchTargetIds,
                    parentElementsIdsPath,
                    childrenCount: totalSearchTargetsChildrenCount,
                    categoryOfTopMostParentElement,
                  })
                : EMPTY,
              // Set childrenCount to undefined for non search targets, as some of their child elements might be filtered out.
              // Since childrenCount is set to undefined, these elements won't check child always/never drawn child elements status.
              // Child always/never drawn elements will be in search paths, and their visibility status will be handled separately.
              nonSearchTargetIds.length > 0
                ? this.#visibilityHelper.getElementsVisibilityStatus({
                    modelId,
                    categoryId,
                    elementIds: nonSearchTargetIds,
                    parentElementsIdsPath,
                    childrenCount: undefined,
                    categoryOfTopMostParentElement,
                  })
                : EMPTY,
            ).pipe(mergeVisibilityStatuses());
          }),
        ),
      ),
    );
  }
}
