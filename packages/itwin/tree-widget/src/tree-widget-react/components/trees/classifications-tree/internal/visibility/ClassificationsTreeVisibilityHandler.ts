/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { concat, defer, from, map, merge, mergeMap, of, toArray } from "rxjs";
import { assert, Id64 } from "@itwin/core-bentley";
import { HierarchyNodeKey } from "@itwin/presentation-hierarchies";
import { fromWithRelease, getIdsFromChildrenTree, getParentElementsIdsPath, setDifference, setIntersection } from "../../../common/internal/Utils.js";
import { mergeVisibilityStatuses } from "../../../common/internal/VisibilityUtils.js";
import { ClassificationsTreeNodeInternal } from "../ClassificationsTreeNodeInternal.js";
import { ClassificationsTreeVisibilityHelper } from "./ClassificationsTreeVisibilityHelper.js";

import type { Observable } from "rxjs";
import type { Id64Set, Id64String } from "@itwin/core-bentley";
import type { HierarchyNode } from "@itwin/presentation-hierarchies";
import type { AlwaysAndNeverDrawnElementInfo } from "../../../common/internal/AlwaysAndNeverDrawnElementInfo.js";
import type { CategoryId, ElementId, ModelId } from "../../../common/internal/Types.js";
import type { ChildrenTree } from "../../../common/internal/Utils.js";
import type { BaseIdsCache, TreeSpecificVisibilityHandler } from "../../../common/internal/visibility/BaseVisibilityHelper.js";
import type { TreeWidgetViewport } from "../../../common/TreeWidgetViewport.js";
import type { VisibilityStatus } from "../../../common/UseHierarchyVisibility.js";
import type { ClassificationsTreeIdsCache } from "../ClassificationsTreeIdsCache.js";
import type { ClassificationsTreeSearchTargets } from "./SearchResultsTree.js";

/** @internal */
export interface ClassificationsTreeVisibilityHandlerProps {
  idsCache: ClassificationsTreeIdsCache;
  viewport: TreeWidgetViewport;
  alwaysAndNeverDrawnElementInfo: AlwaysAndNeverDrawnElementInfo<ClassificationsTreeSearchTargets>;
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
      getAllChildrenCount: (props) => this.getAllChildrenCount(props),
      getChildrenTree: (props) => this.getChildrenTree(props),
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
        observables.push(this.changeSearchTargetElementsVisibilityStatus({ elements: elements2d, on, type: "2d" }));
      }

      if (elements3d?.length) {
        observables.push(this.changeSearchTargetElementsVisibilityStatus({ elements: elements3d, on, type: "3d" }));
      }

      return merge(...observables);
    });
  }

  private changeSearchTargetElementsVisibilityStatus({
    elements,
    on,
    type,
  }: {
    elements: Required<ClassificationsTreeSearchTargets>["elements2d"] | Required<ClassificationsTreeSearchTargets>["elements3d"];
    on: boolean;
    type: "2d" | "3d";
  }): Observable<void> {
    const searchTargetElements = new Array<Id64String>();
    const elementIdsSet = new Set<Id64String>();
    const modelCategoryElementMap = new Map<`${ModelId}-${CategoryId}`, Array<ElementId>>();
    // elements is an array that stores elements grouped by:
    // 1. Their path
    // 2. Their modelId and categoryId
    // When changing visibility of elements, visibility handler does not care about the path.
    // So we can first get all elements and group them only by modelId and categoryId.
    elements.forEach(({ elements: elementsMap, categoryId, modelId }) => {
      const key: `${ModelId}-${CategoryId}` = `${modelId}-${categoryId}`;
      let mapEntry = modelCategoryElementMap.get(key);
      if (!mapEntry) {
        mapEntry = [];
        modelCategoryElementMap.set(key, mapEntry);
      }
      elementsMap.forEach(({ isSearchTarget }, elementId) => {
        mapEntry.push(elementId);
        elementIdsSet.add(elementId);
        if (isSearchTarget) {
          searchTargetElements.push(elementId);
        }
      });
    });
    // Get children for search targets, since non search targets don't have all the children present in the hierarchy.
    return this.#props.idsCache.getChildrenTree({ elementIds: searchTargetElements, type }).pipe(
      // Need to filter out and keep only those children ids that are not part of elements that are present in search paths.
      // Elements in search paths will have their visibility changed directly: they will be provided as elementIds to changeElementsVisibilityStatus.
      map((childrenTree) => ({
        childrenNotInSearchPaths: setDifference(getIdsFromChildrenTree({ tree: childrenTree, predicate: ({ depth }) => depth > 0 }), elementIdsSet),
        childrenTree,
      })),
      mergeMap(({ childrenNotInSearchPaths, childrenTree }) =>
        fromWithRelease({ source: [...modelCategoryElementMap.entries()], releaseOnCount: 50 }).pipe(
          mergeMap(([key, elementsInSearchPathsGroupedByModelAndCategory]) => {
            const [modelId, categoryId] = key.split("-");
            const childrenIds = new Set<Id64String>();
            // A shared children tree was created, need to get the children for each element in the group.
            elementsInSearchPathsGroupedByModelAndCategory.forEach((elementId) => {
              const elementChildrenTree: ChildrenTree | undefined = childrenTree.get(elementId)?.children;
              if (elementChildrenTree) {
                getIdsFromChildrenTree({ tree: elementChildrenTree }).forEach((childId) => childrenIds.add(childId));
              }
            });
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
      type: node.extendedData.type,
      parentElementsIdsPath,
      childrenCount: node.extendedData.childrenCount,
      categoryOfTopMostParentElement: node.extendedData.categoryOfTopMostParentElement,
    });
  }

  /** Changes visibility of the items represented by the tree node. */
  public changeVisibilityStatus(node: HierarchyNode, on: boolean): Observable<void> {
    const changeObs = defer(() => {
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
      return this.#props.idsCache.getChildrenTree({ elementIds, type: node.extendedData.type === "GeometricElement3d" ? "3d" : "2d" }).pipe(
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
        observables.push(this.getSearchTargetElementsVisibilityStatus({ elements: elements2d, type: "2d" }));
      }

      if (elements3d?.length) {
        observables.push(this.getSearchTargetElementsVisibilityStatus({ elements: elements3d, type: "3d" }));
      }

      return merge(...observables);
    }).pipe(mergeVisibilityStatuses);
  }

  private getSearchTargetElementsVisibilityStatus({
    elements,
    type,
  }: {
    elements: Required<ClassificationsTreeSearchTargets>["elements2d"] | Required<ClassificationsTreeSearchTargets>["elements3d"];
    type: "2d" | "3d";
  }): Observable<VisibilityStatus> {
    const searchTargetElements = new Array<Id64String>();
    elements.forEach(({ elements: elementsMap }) =>
      elementsMap.forEach(({ isSearchTarget }, elementId) => {
        if (isSearchTarget) {
          searchTargetElements.push(elementId);
        }
      }),
    );
    return this.#props.idsCache.getAllChildrenCount({ elementIds: searchTargetElements, type }).pipe(
      mergeMap((elementsChildrenCountMap) =>
        fromWithRelease({ source: elements, releaseOnCount: 50 }).pipe(
          mergeMap(({ modelId, categoryId, elements: elementsMap, pathToElements, categoryOfTopMostParentElement, topMostParentElementId }) => {
            const parentElementsIdsPath = topMostParentElementId
              ? getParentElementsIdsPath({
                  parentInstanceKeys: pathToElements.map((instanceKey) => [instanceKey]),
                  topMostParentElementId,
                })
              : [];
            let totalChildrenCount = 0;
            elementsMap.forEach((_, elementId) => {
              const childCount = elementsChildrenCountMap.get(elementId);
              if (childCount) {
                totalChildrenCount += childCount;
              }
            });
            return this.#visibilityHelper.getElementsVisibilityStatus({
              modelId,
              categoryId,
              elementIds: [...elementsMap.keys()],
              type: type === "3d" ? "GeometricElement3d" : "GeometricElement2d",
              parentElementsIdsPath,
              childrenCount: totalChildrenCount,
              categoryOfTopMostParentElement,
            });
          }),
        ),
      ),
    );
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

  private getChildrenTree(props: Parameters<BaseIdsCache["getChildrenTree"]>[0]): ReturnType<BaseIdsCache["getChildrenTree"]> {
    return this.#props.idsCache.getChildrenTree({ elementIds: props.elementIds, type: props.type });
  }

  private getAllChildrenCount(props: Parameters<BaseIdsCache["getAllChildrenCount"]>[0]): ReturnType<BaseIdsCache["getAllChildrenCount"]> {
    return this.#props.idsCache.getAllChildrenCount({ elementIds: props.elementIds, type: props.type });
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
