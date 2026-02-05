/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { concat, defer, EMPTY, from, map, merge, mergeAll, mergeMap, of } from "rxjs";
import { assert, Guid, Id64 } from "@itwin/core-bentley";
import { HierarchyNodeKey } from "@itwin/presentation-hierarchies";
import { createVisibilityStatus } from "../../../common/internal/Tooltip.js";
import { HierarchyVisibilityHandlerImpl } from "../../../common/internal/useTreeHooks/UseCachedVisibility.js";
import { fromWithRelease, getIdsFromChildrenTree, getParentElementsIdsPath, setDifference, setIntersection } from "../../../common/internal/Utils.js";
import { mergeVisibilityStatuses } from "../../../common/internal/VisibilityUtils.js";
import { ModelsTreeNodeInternal } from "../ModelsTreeNodeInternal.js";
import { ModelsTreeVisibilityHelper } from "./ModelsTreeVisibilityHelper.js";
import { createModelsSearchResultsTree } from "./SearchResultsTree.js";

import type { Observable } from "rxjs";
import type { Id64Arg, Id64Set, Id64String } from "@itwin/core-bentley";
import type { ClassGroupingNodeKey, GroupingHierarchyNode, HierarchyNode, HierarchySearchPath, InstancesNodeKey } from "@itwin/presentation-hierarchies";
import type { ECClassHierarchyInspector } from "@itwin/presentation-shared";
import type { AlwaysAndNeverDrawnElementInfoCache } from "../../../common/internal/caches/AlwaysAndNeverDrawnElementInfoCache.js";
import type { CategoryId, ElementId, ModelId } from "../../../common/internal/Types.js";
import type { ChildrenTree } from "../../../common/internal/Utils.js";
import type { SearchResultsTree } from "../../../common/internal/visibility/BaseSearchResultsTree.js";
import type {
  BaseIdsCache,
  BaseTreeVisibilityHandlerOverrides,
  TreeSpecificVisibilityHandler,
} from "../../../common/internal/visibility/BaseVisibilityHelper.js";
import type { TreeWidgetViewport } from "../../../common/TreeWidgetViewport.js";
import type {
  HierarchyVisibilityHandlerOverridableMethod,
  HierarchyVisibilityOverrideHandler,
  VisibilityStatus,
} from "../../../common/UseHierarchyVisibility.js";
import type { ModelsTreeIdsCache } from "../ModelsTreeIdsCache.js";
import type { ModelsTreeSearchTargets } from "./SearchResultsTree.js";

/**
 * Functionality of Models tree visibility handler that can be overridden.
 * Each callback is provided original implementation and reference to a `HierarchyVisibilityHandler`.
 * @beta
 */
export interface ModelsTreeVisibilityHandlerOverrides extends BaseTreeVisibilityHandlerOverrides {
  getSubjectsVisibilityStatus?: HierarchyVisibilityHandlerOverridableMethod<(props: { subjectIds: Id64Arg }) => Promise<VisibilityStatus>>;
  getElementGroupingNodeVisibilityStatus?: HierarchyVisibilityHandlerOverridableMethod<(props: { node: GroupingHierarchyNode }) => Promise<VisibilityStatus>>;

  changeSubjectsVisibilityStatus?: HierarchyVisibilityHandlerOverridableMethod<(props: { subjectIds: Id64Arg; on: boolean }) => Promise<void>>;
  changeElementGroupingNodeVisibilityStatus?: HierarchyVisibilityHandlerOverridableMethod<
    (props: { node: GroupingHierarchyNode; on: boolean }) => Promise<void>
  >;
}

/** @internal */
export interface ModelsTreeVisibilityHandlerProps {
  idsCache: ModelsTreeIdsCache;
  viewport: TreeWidgetViewport;
  alwaysAndNeverDrawnElementInfo: AlwaysAndNeverDrawnElementInfoCache;
  overrideHandler: HierarchyVisibilityOverrideHandler;
  overrides?: ModelsTreeVisibilityHandlerOverrides;
}

/**
 * Handles visibility status of models tree nodes.
 *
 * It knows how to get and change visibility status of nodes created by hierarchy definition.
 * @internal
 */
export class ModelsTreeVisibilityHandler implements Disposable, TreeSpecificVisibilityHandler<ModelsTreeSearchTargets> {
  #visibilityHelper: ModelsTreeVisibilityHelper;
  readonly #props: ModelsTreeVisibilityHandlerProps;

  constructor(constructorProps: ModelsTreeVisibilityHandlerProps) {
    this.#props = constructorProps;
    // Remove after https://github.com/iTwin/viewer-components-react/issues/1421.
    // We won't need to create a custom base ids cache.
    const baseIdsCache: BaseIdsCache = {
      getAllChildElementsCount: (props) => this.getAllChildElementsCount(props),
      getCategories: (props) => this.getCategories(props),
      getChildElementsTree: (props) => this.getChildElementsTree(props),
      getElementsCount: (props) => this.getElementsCount(props),
      getModels: (props) => this.getModels(props),
      getSubCategories: (props) => this.getSubCategories(props),
      getSubModels: (props) => this.getSubModels(props),
      hasSubModel: (props) => this.#props.idsCache.hasSubModel(props),
      getAllCategoriesOfElements: () => this.getAllCategoriesOfElements(),
    };
    this.#visibilityHelper = new ModelsTreeVisibilityHelper({
      viewport: this.#props.viewport,
      idsCache: this.#props.idsCache,
      alwaysAndNeverDrawnElementInfo: this.#props.alwaysAndNeverDrawnElementInfo,
      overrideHandler: this.#props.overrideHandler,
      baseIdsCache,
      overrides: this.#props.overrides,
    });
  }

  public [Symbol.dispose]() {
    this.#visibilityHelper[Symbol.dispose]();
  }

  public changeSearchTargetsVisibilityStatus(targets: ModelsTreeSearchTargets, on: boolean): Observable<void> {
    return defer(() => {
      const { subjectIds, modelIds, categories, elements } = targets;
      const observables = new Array<Observable<void>>();
      if (this.#props.viewport.viewType !== "3d") {
        return EMPTY;
      }
      if (subjectIds?.size) {
        observables.push(this.#visibilityHelper.changeSubjectsVisibilityStatus({ subjectIds, on }));
      }

      if (modelIds?.size) {
        observables.push(this.#visibilityHelper.changeModelsVisibilityStatus({ modelIds, on }));
      }

      if (categories?.length) {
        observables.push(
          from(categories).pipe(
            mergeMap(({ modelId, categoryIds }) =>
              this.#visibilityHelper.changeCategoriesVisibilityStatus({
                categoryIds,
                modelId,
                on,
              }),
            ),
          ),
        );
      }

      if (elements?.length) {
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
        observables.push(
          // Get children for search targets, since non search targets don't have all the children present in the hierarchy.
          this.#props.idsCache.getChildElementsTree({ elementIds: searchTargetElements }).pipe(
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
          ),
        );
      }

      return merge(...observables);
    });
  }

  public getVisibilityStatus(node: HierarchyNode): Observable<VisibilityStatus> {
    if (this.#props.viewport.viewType !== "3d") {
      return of(createVisibilityStatus("disabled"));
    }

    if (ModelsTreeNodeInternal.isElementClassGroupingNode(node)) {
      const result = this.#visibilityHelper.getGroupedElementsVisibilityStatus({
        categoryId: node.extendedData.categoryId,
        modelId: node.extendedData.modelId,
        elementIds: node.groupedInstanceKeys.map((key) => key.id),
        parentKeys: node.parentKeys,
        childrenCount: node.extendedData.childrenCount,
        categoryOfTopMostParentElement: node.extendedData.categoryOfTopMostParentElement,
        topMostParentElementId: node.extendedData.topMostParentElementId,
      });
      return this.#props.overrideHandler.createVisibilityHandlerResult({
        overrideProps: { node },
        nonOverriddenResult: result,
        override: this.#props.overrides?.getElementGroupingNodeVisibilityStatus,
      });
    }

    if (ModelsTreeNodeInternal.isSubjectNode(node)) {
      // note: subject nodes may be merged to represent multiple subject instances
      return this.#visibilityHelper.getSubjectsVisibilityStatus({ subjectIds: node.key.instanceKeys.map((key) => key.id) });
    }

    if (ModelsTreeNodeInternal.isModelNode(node)) {
      return this.#visibilityHelper.getModelsVisibilityStatus({ modelIds: node.key.instanceKeys.map(({ id }) => id) });
    }

    if (ModelsTreeNodeInternal.isCategoryNode(node)) {
      return this.#visibilityHelper.getCategoriesVisibilityStatus({
        categoryIds: node.key.instanceKeys.map(({ id }) => id),
        modelId: node.extendedData.modelIds[0],
      });
    }

    assert(ModelsTreeNodeInternal.isElementNode(node));
    const parentElementsIdsPath = getParentElementsIdsPath({
      parentInstanceKeys: node.parentKeys.filter((key) => HierarchyNodeKey.isInstances(key)).map((key) => key.instanceKeys),
      topMostParentElementId: node.extendedData.topMostParentElementId,
    });
    return this.#visibilityHelper.getElementsVisibilityStatus({
      elementIds: node.key.instanceKeys.map(({ id }) => id),
      modelId: node.extendedData.modelId,
      categoryId: node.extendedData.categoryId,
      parentElementsIdsPath,
      childrenCount: node.extendedData?.childrenCount,
      categoryOfTopMostParentElement: node.extendedData.categoryOfTopMostParentElement,
    });
  }

  /** Changes visibility of the items represented by the tree node. */
  public changeVisibilityStatus(node: HierarchyNode, on: boolean): Observable<void> {
    const changeObs = defer(() => {
      if (this.#props.viewport.viewType !== "3d") {
        return EMPTY;
      }
      if (ModelsTreeNodeInternal.isElementClassGroupingNode(node)) {
        const result = this.#visibilityHelper.changeGroupedElementsVisibilityStatus({
          categoryId: node.extendedData.categoryId,
          modelId: node.extendedData.modelId,
          elementIds: node.groupedInstanceKeys.map((key) => key.id),
          on,
        });
        return this.#props.overrideHandler.createVisibilityHandlerResult({
          overrideProps: { node, on },
          nonOverriddenResult: result,
          override: this.#props.overrides?.changeElementGroupingNodeVisibilityStatus,
        });
      }

      if (ModelsTreeNodeInternal.isSubjectNode(node)) {
        return this.#visibilityHelper.changeSubjectsVisibilityStatus({
          subjectIds: node.key.instanceKeys.map((key) => key.id),
          on,
        });
      }

      if (ModelsTreeNodeInternal.isModelNode(node)) {
        return this.#visibilityHelper.changeModelsVisibilityStatus({ modelIds: node.key.instanceKeys.map(({ id }) => id), on });
      }

      if (ModelsTreeNodeInternal.isCategoryNode(node)) {
        return this.#visibilityHelper.changeCategoriesVisibilityStatus({
          categoryIds: node.key.instanceKeys.map(({ id }) => id),
          modelId: node.extendedData.modelIds[0],
          on,
        });
      }

      assert(ModelsTreeNodeInternal.isElementNode(node));
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
            children: children.size > 0 ? children : undefined,
            categoryId: node.extendedData.categoryId,
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

  public getSearchTargetsVisibilityStatus(
    targets: ModelsTreeSearchTargets,
    node: HierarchyNode & {
      key: ClassGroupingNodeKey | InstancesNodeKey;
    },
  ): Observable<VisibilityStatus> {
    return defer(() => {
      const { subjectIds, modelIds, categories, elements } = targets;
      const observables = new Array<Observable<VisibilityStatus>>();
      if (this.#props.viewport.viewType !== "3d") {
        return of(createVisibilityStatus("disabled"));
      }
      if (subjectIds?.size) {
        observables.push(this.#visibilityHelper.getSubjectsVisibilityStatus({ subjectIds }));
      }

      if (modelIds?.size) {
        observables.push(this.#visibilityHelper.getModelsVisibilityStatus({ modelIds }));
      }

      if (categories?.length) {
        observables.push(
          from(categories).pipe(
            mergeMap(({ modelId, categoryIds }) =>
              this.#visibilityHelper.getCategoriesVisibilityStatus({
                categoryIds,
                modelId,
              }),
            ),
          ),
        );
      }

      if (elements?.length) {
        const searchTargetElements = new Array<Id64String>();
        elements.forEach(({ elements: elementsMap }) =>
          elementsMap.forEach(({ isSearchTarget }, elementId) => {
            if (isSearchTarget) {
              searchTargetElements.push(elementId);
            }
          }),
        );
        let childrenCountMapObs: Observable<Map<Id64String, number>>;
        if (ModelsTreeNodeInternal.isElementClassGroupingNode(node)) {
          const groupingNodesSearchTargets: Map<Id64String, { childrenCount: number }> | undefined = node.extendedData.searchTargets;
          const nestedSearchTargetElements = searchTargetElements.filter((searchTarget) => !groupingNodesSearchTargets?.has(searchTarget));
          // Only need to request children count for indirect children search targets.
          childrenCountMapObs = this.#props.idsCache.getAllChildElementsCount({ elementIds: nestedSearchTargetElements }).pipe(
            map((elementCountMap) => {
              // Direct children search targets already have children count stored in grouping nodes extended data.
              node.extendedData.searchTargets?.forEach((value, key) => elementCountMap.set(key, value.childrenCount));
              return elementCountMap;
            }),
          );
        } else {
          childrenCountMapObs = this.#props.idsCache.getAllChildElementsCount({ elementIds: searchTargetElements });
        }
        observables.push(
          childrenCountMapObs.pipe(
            mergeMap((elementsChildrenCountMap) =>
              fromWithRelease({ source: elements, releaseOnCount: 50 }).pipe(
                mergeMap(({ modelId, elements: elementsMap, categoryId, pathToElements, topMostParentElementId }) => {
                  const parentElementsIdsPath = topMostParentElementId
                    ? getParentElementsIdsPath({
                        parentInstanceKeys: pathToElements.map((instanceKey) => [instanceKey]),
                        topMostParentElementId,
                      })
                    : [];
                  let totalSearchTargetsChildrenCount = 0;
                  const nonSearchTargetIds = new Array<Id64String>();
                  const searchTargetIds = new Array<Id64String>();
                  elementsMap.forEach(({ isSearchTarget }, elementId) => {
                    if (!isSearchTarget) {
                      nonSearchTargetIds.push(elementId);
                      return;
                    }
                    searchTargetIds.push(elementId);
                    const childCount = elementsChildrenCountMap.get(elementId);
                    if (childCount) {
                      totalSearchTargetsChildrenCount += childCount;
                    }
                  });
                  return merge(
                    searchTargetIds.length > 0
                      ? this.#visibilityHelper.getElementsVisibilityStatus({
                          modelId,
                          categoryId,
                          elementIds: searchTargetIds,
                          parentElementsIdsPath,
                          childrenCount: totalSearchTargetsChildrenCount,
                          // Search results tree is created on search paths. Since search paths contain only categories that are directly under models
                          // or at the root, categoryId can be used here here.
                          categoryOfTopMostParentElement: categoryId,
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
                          // Search results tree is created on search paths. Since search paths contain only categories that are directly under models
                          // or at the root, categoryId can be used here here.
                          categoryOfTopMostParentElement: categoryId,
                        })
                      : EMPTY,
                  ).pipe(mergeVisibilityStatuses);
                }),
              ),
            ),
          ),
        );
      }

      return from(observables).pipe(mergeAll(), mergeVisibilityStatuses);
    });
  }

  private getCategories(props: Parameters<BaseIdsCache["getCategories"]>[0]): ReturnType<BaseIdsCache["getCategories"]> {
    return from(Id64.iterable(props.modelIds)).pipe(
      mergeMap((modelId) => this.#props.idsCache.getModelCategoryIds(modelId).pipe(map((categoryIds) => ({ id: modelId, categories: categoryIds })))),
    );
  }

  private getChildElementsTree(props: Parameters<BaseIdsCache["getChildElementsTree"]>[0]): ReturnType<BaseIdsCache["getChildElementsTree"]> {
    return this.#props.idsCache.getChildElementsTree({ elementIds: props.elementIds });
  }

  private getAllCategoriesOfElements(): ReturnType<BaseIdsCache["getAllCategoriesOfElements"]> {
    return this.#props.idsCache.getAllCategoriesOfElements();
  }

  private getAllChildElementsCount(props: Parameters<BaseIdsCache["getAllChildElementsCount"]>[0]): ReturnType<BaseIdsCache["getAllChildElementsCount"]> {
    return this.#props.idsCache.getAllChildElementsCount({ elementIds: props.elementIds });
  }

  private getElementsCount(props: Parameters<BaseIdsCache["getElementsCount"]>[0]): ReturnType<BaseIdsCache["getElementsCount"]> {
    return this.#props.idsCache.getCategoryElementsCount(props);
  }

  private getModels(props: Parameters<BaseIdsCache["getModels"]>[0]): ReturnType<BaseIdsCache["getModels"]> {
    return this.#props.idsCache.getCategoriesElementModels(props.categoryIds);
  }

  private getSubCategories(props: Parameters<BaseIdsCache["getSubCategories"]>[0]): ReturnType<BaseIdsCache["getSubCategories"]> {
    return this.#props.idsCache.getSubCategories(props.categoryId);
  }

  private getSubModels(props: Parameters<BaseIdsCache["getSubModels"]>[0]): ReturnType<BaseIdsCache["getSubModels"]> {
    if ("modelIds" in props) {
      return from(Id64.iterable(props.modelIds)).pipe(
        mergeMap((modelId) => {
          if (props.categoryId) {
            return this.#props.idsCache
              .getCategoriesModeledElements({ modelId, categoryIds: props.categoryId })
              .pipe(map((subModels) => ({ id: modelId, subModels })));
          }
          return this.#props.idsCache.getModelCategoryIds(modelId).pipe(
            mergeMap((categoryIds) => this.#props.idsCache.getCategoriesModeledElements({ modelId, categoryIds })),
            map((subModels) => ({ id: modelId, subModels })),
          );
        }),
      );
    }

    if (props.modelId) {
      return from(Id64.iterable(props.categoryIds)).pipe(
        mergeMap((categoryId) =>
          this.#props.idsCache
            .getCategoriesModeledElements({ modelId: props.modelId!, categoryIds: categoryId })
            .pipe(map((subModels) => ({ id: categoryId, subModels }))),
        ),
      );
    }

    return this.#props.idsCache.getCategoriesElementModels(props.categoryIds).pipe(
      mergeMap(({ id, models }) => {
        if (!models) {
          return of({ id, subModels: undefined });
        }
        return from(models).pipe(
          mergeMap((modelId) => this.#props.idsCache.getCategoriesModeledElements({ modelId, categoryIds: id })),
          map((subModels) => ({ id, subModels })),
        );
      }),
    );
  }
}

/**
 * Creates models tree visibility handler. Is used by integration and performance tests.
 * @internal
 */
export function createModelsTreeVisibilityHandler(props: {
  viewport: TreeWidgetViewport;
  idsCache: ModelsTreeIdsCache;
  imodelAccess: ECClassHierarchyInspector;
  overrides?: ModelsTreeVisibilityHandlerOverrides;
  searchPaths?: HierarchySearchPath[];
}) {
  return new HierarchyVisibilityHandlerImpl<ModelsTreeSearchTargets>({
    getSearchResultsTree: (): undefined | Promise<SearchResultsTree<ModelsTreeSearchTargets>> => {
      if (!props.searchPaths) {
        return undefined;
      }
      return createModelsSearchResultsTree({
        searchPaths: props.searchPaths,
        imodelAccess: props.imodelAccess,
      });
    },
    getTreeSpecificVisibilityHandler: (info, overrideHandler) => {
      return new ModelsTreeVisibilityHandler({
        alwaysAndNeverDrawnElementInfo: info,
        idsCache: props.idsCache,
        viewport: props.viewport,
        overrideHandler,
        overrides: props.overrides,
      });
    },
    viewport: props.viewport,
    componentId: Guid.createValue(),
  });
}
