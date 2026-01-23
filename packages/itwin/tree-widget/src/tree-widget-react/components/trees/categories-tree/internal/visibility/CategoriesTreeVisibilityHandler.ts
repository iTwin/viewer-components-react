/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { concat, defer, from, map, merge, mergeMap, of } from "rxjs";
import { assert, Guid, Id64 } from "@itwin/core-bentley";
import { HierarchyNodeKey } from "@itwin/presentation-hierarchies";
import { HierarchyVisibilityHandlerImpl } from "../../../common/internal/useTreeHooks/UseCachedVisibility.js";
import {
  fromWithRelease,
  getClassesByView,
  getIdsFromChildrenTree,
  getParentElementsIdsPath,
  setDifference,
  setIntersection,
} from "../../../common/internal/Utils.js";
import { mergeVisibilityStatuses } from "../../../common/internal/VisibilityUtils.js";
import { CategoriesTreeNodeInternal } from "../../internal/CategoriesTreeNodeInternal.js";
import { CategoriesTreeVisibilityHelper } from "./CategoriesTreeVisibilityHelper.js";
import { createCategoriesSearchResultsTree } from "./SearchResultsTree.js";

import type { Observable } from "rxjs";
import type { Id64Set, Id64String } from "@itwin/core-bentley";
import type { ClassGroupingNodeKey, HierarchyNode, HierarchySearchPath, InstancesNodeKey } from "@itwin/presentation-hierarchies";
import type { ECClassHierarchyInspector } from "@itwin/presentation-shared";
import type { AlwaysAndNeverDrawnElementInfo } from "../../../common/internal/AlwaysAndNeverDrawnElementInfo.js";
import type { CategoryId, ElementId, ModelId } from "../../../common/internal/Types.js";
import type { ChildrenTree } from "../../../common/internal/Utils.js";
import type { SearchResultsTree } from "../../../common/internal/visibility/BaseSearchResultsTree.js";
import type { BaseIdsCache, TreeSpecificVisibilityHandler } from "../../../common/internal/visibility/BaseVisibilityHelper.js";
import type { TreeWidgetViewport } from "../../../common/TreeWidgetViewport.js";
import type { VisibilityStatus } from "../../../common/UseHierarchyVisibility.js";
import type { CategoriesTreeHierarchyConfiguration } from "../../CategoriesTreeDefinition.js";
import type { CategoriesTreeIdsCache } from "../CategoriesTreeIdsCache.js";
import type { CategoriesTreeSearchTargets } from "./SearchResultsTree.js";

/** @internal */
export interface CategoriesTreeVisibilityHandlerProps {
  idsCache: CategoriesTreeIdsCache;
  viewport: TreeWidgetViewport;
  alwaysAndNeverDrawnElementInfo: AlwaysAndNeverDrawnElementInfo<CategoriesTreeSearchTargets>;
  hierarchyConfig: CategoriesTreeHierarchyConfiguration;
}

/**
 * Handles visibility status of categories tree nodes.
 *
 * This handler knows how to get and change visibility status of nodes created by hierarchy definition.
 * @internal
 */
export class CategoriesTreeVisibilityHandler implements Disposable, TreeSpecificVisibilityHandler<CategoriesTreeSearchTargets> {
  readonly #props: CategoriesTreeVisibilityHandlerProps;
  #visibilityHelper: CategoriesTreeVisibilityHelper;
  #elementType: "GeometricElement3d" | "GeometricElement2d";
  #categoryType: "DrawingCategory" | "SpatialCategory";
  #modelType: "GeometricModel3d" | "GeometricModel2d";
  constructor(constructorProps: CategoriesTreeVisibilityHandlerProps) {
    this.#props = constructorProps;
    // Remove after https://github.com/iTwin/viewer-components-react/issues/1421.
    // We won't need to create a custom base ids cache.
    const baseIdsCache: BaseIdsCache = {
      getChildrenTree: (props) => this.getChildrenTree(props),
      getAllChildrenCount: (props) => this.getAllChildrenCount(props),
      getCategories: (props) => this.getCategories(props),
      getAllCategories: () => this.getAllCategories(),
      getElementsCount: (props) => this.getElementsCount(props),
      getModels: (props) => this.getModels(props),
      getSubCategories: (props) => this.getSubCategories(props),
      getSubModels: (props) => this.getSubModels(props),
      hasSubModel: (props) => this.#props.idsCache.hasSubModel(props),
    };
    this.#visibilityHelper = new CategoriesTreeVisibilityHelper({
      viewport: this.#props.viewport,
      idsCache: this.#props.idsCache,
      alwaysAndNeverDrawnElementInfo: this.#props.alwaysAndNeverDrawnElementInfo,
      baseIdsCache,
      hierarchyConfig: constructorProps.hierarchyConfig,
    });
    const { elementType, categoryType, modelType } =
      this.#props.viewport.viewType === "2d"
        ? {
            elementType: "GeometricElement2d" as const,
            categoryType: "DrawingCategory" as const,
            modelType: "GeometricModel2d" as const,
          }
        : {
            elementType: "GeometricElement3d" as const,
            categoryType: "SpatialCategory" as const,
            modelType: "GeometricModel3d" as const,
          };
    this.#elementType = elementType;
    this.#categoryType = categoryType;
    this.#modelType = modelType;
  }

  public [Symbol.dispose]() {
    this.#visibilityHelper[Symbol.dispose]();
  }

  public changeSearchTargetsVisibilityStatus(targets: CategoriesTreeSearchTargets, on: boolean): Observable<void> {
    return defer(() => {
      const { definitionContainerIds, subCategories, modelIds, categories, elements } = targets;
      const observables = new Array<Observable<void>>();
      if (definitionContainerIds?.size) {
        observables.push(this.#visibilityHelper.changeDefinitionContainersVisibilityStatus({ definitionContainerIds, on }));
      }

      if (modelIds?.size) {
        observables.push(this.#visibilityHelper.changeModelsVisibilityStatus({ modelIds, on }));
      }

      if (categories?.length) {
        observables.push(
          from(categories).pipe(mergeMap(({ modelId, categoryIds }) => this.#visibilityHelper.changeCategoriesVisibilityStatus({ categoryIds, modelId, on }))),
        );
      }

      if (subCategories?.length) {
        observables.push(
          from(subCategories).pipe(
            mergeMap(({ categoryId, subCategoryIds }) => this.#visibilityHelper.changeSubCategoriesVisibilityStatus({ subCategoryIds, categoryId, on })),
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
          this.#props.idsCache.getChildrenTree({ elementIds: searchTargetElements }).pipe(
            // Need to filter out and keep only those children ids that are not part of elements that are present in search paths.
            // Elements in search paths will have their visibility changed directly: they will be provided as elementIds to changeElementsVisibilityStatus.
            map((childrenTree) => ({
              childrenNotInSearchPaths: setDifference(getIdsFromChildrenTree({ tree: childrenTree, predicate: ({ depth }) => depth > 0 }), elementIdsSet),
              childrenTree,
            })),
            mergeMap(({ childrenNotInSearchPaths, childrenTree }) =>
              fromWithRelease({ source: Array.from(modelCategoryElementMap.entries()), releaseOnCount: 50 }).pipe(
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
    if (CategoriesTreeNodeInternal.isElementClassGroupingNode(node)) {
      return this.#visibilityHelper.getGroupedElementsVisibilityStatus({
        categoryId: node.extendedData.categoryId,
        modelElementsMap: node.extendedData.modelElementsMap,
        parentKeys: node.parentKeys,
        childrenCount: node.extendedData.childrenCount,
      });
    }

    if (CategoriesTreeNodeInternal.isDefinitionContainerNode(node)) {
      return this.#visibilityHelper.getDefinitionContainersVisibilityStatus({
        definitionContainerIds: node.key.instanceKeys.map((instanceKey) => instanceKey.id),
      });
    }

    if (CategoriesTreeNodeInternal.isModelNode(node)) {
      return this.#visibilityHelper.getModelsVisibilityStatus({
        modelIds: node.key.instanceKeys.map((instanceKey) => instanceKey.id),
        type: this.#modelType,
      });
    }

    if (CategoriesTreeNodeInternal.isCategoryNode(node)) {
      return this.#visibilityHelper.getCategoriesVisibilityStatus({
        categoryIds: node.key.instanceKeys.map((instanceKey) => instanceKey.id),
        modelId: node.extendedData.isCategoryOfSubModel ? node.extendedData.modelIds[0] : undefined,
        type: this.#categoryType,
      });
    }

    if (CategoriesTreeNodeInternal.isSubCategoryNode(node)) {
      return of(
        this.#visibilityHelper.getSubCategoriesVisibilityStatus({
          categoryId: node.extendedData.categoryId,
          subCategoryIds: node.key.instanceKeys.map((instanceKey) => instanceKey.id),
        }),
      );
    }

    assert(CategoriesTreeNodeInternal.isElementNode(node));
    const parentElementsIdsPath = getParentElementsIdsPath({
      parentInstanceKeys: node.parentKeys.filter((parentKey) => HierarchyNodeKey.isInstances(parentKey)).map((key) => key.instanceKeys),
      topMostParentElementId: node.extendedData.topMostParentElementId,
    });
    return this.#visibilityHelper.getElementsVisibilityStatus({
      elementIds: node.key.instanceKeys.map((instanceKey) => instanceKey.id),
      modelId: node.extendedData.modelId,
      categoryId: node.extendedData.categoryId,
      type: this.#elementType,
      parentElementsIdsPath,
      childrenCount: node.extendedData.childrenCount,
      categoryOfTopMostParentElement: node.extendedData.categoryOfTopMostParentElement,
    });
  }

  /** Changes visibility of the items represented by the tree node. */
  public changeVisibilityStatus(node: HierarchyNode, on: boolean): Observable<void> {
    const changeObs = defer(() => {
      if (CategoriesTreeNodeInternal.isElementClassGroupingNode(node)) {
        return this.#visibilityHelper.changeGroupedElementsVisibilityStatus({
          categoryId: node.extendedData.categoryId,
          modelElementsMap: node.extendedData.modelElementsMap,
          on,
        });
      }

      if (CategoriesTreeNodeInternal.isDefinitionContainerNode(node)) {
        return this.#visibilityHelper.changeDefinitionContainersVisibilityStatus({
          definitionContainerIds: node.key.instanceKeys.map((instanceKey) => instanceKey.id),
          on,
        });
      }

      if (CategoriesTreeNodeInternal.isModelNode(node)) {
        return this.#visibilityHelper.changeModelsVisibilityStatus({
          modelIds: node.key.instanceKeys.map(({ id }) => id),
          on,
        });
      }

      if (CategoriesTreeNodeInternal.isCategoryNode(node)) {
        return this.#visibilityHelper.changeCategoriesVisibilityStatus({
          categoryIds: node.key.instanceKeys.map((instanceKey) => instanceKey.id),
          modelId: node.extendedData.isCategoryOfSubModel ? node.extendedData.modelIds[0] : undefined,
          on,
        });
      }

      if (CategoriesTreeNodeInternal.isSubCategoryNode(node)) {
        return this.#visibilityHelper.changeSubCategoriesVisibilityStatus({
          categoryId: node.extendedData.categoryId,
          subCategoryIds: node.key.instanceKeys.map((instanceKey) => instanceKey.id),
          on,
        });
      }
      assert(CategoriesTreeNodeInternal.isElementNode(node));

      const elementIds = node.key.instanceKeys.map(({ id }) => id);
      return this.#props.idsCache.getChildrenTree({ elementIds }).pipe(
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
    targets: CategoriesTreeSearchTargets,
    node: HierarchyNode & {
      key: ClassGroupingNodeKey | InstancesNodeKey;
    },
  ): Observable<VisibilityStatus> {
    return defer(() => {
      const { definitionContainerIds, subCategories, modelIds, categories, elements } = targets;
      const observables = new Array<Observable<VisibilityStatus>>();
      if (definitionContainerIds?.size) {
        observables.push(this.#visibilityHelper.getDefinitionContainersVisibilityStatus({ definitionContainerIds }));
      }

      if (modelIds?.size) {
        observables.push(this.#visibilityHelper.getModelsVisibilityStatus({ modelIds, type: this.#modelType }));
      }

      if (categories?.length) {
        observables.push(
          from(categories).pipe(
            mergeMap(({ modelId, categoryIds }) =>
              this.#visibilityHelper.getCategoriesVisibilityStatus({
                categoryIds,
                modelId,
                type: this.#categoryType,
              }),
            ),
          ),
        );
      }

      if (subCategories?.length) {
        observables.push(
          from(subCategories).pipe(
            map(({ categoryId, subCategoryIds }) => this.#visibilityHelper.getSubCategoriesVisibilityStatus({ subCategoryIds, categoryId })),
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
        if (CategoriesTreeNodeInternal.isElementClassGroupingNode(node)) {
          const groupingNodesSearchTargets: Map<Id64String, { childrenCount: number }> | undefined = node.extendedData?.searchTargets;
          const nestedSearchTargetElements = searchTargetElements.filter((searchTarget) => !groupingNodesSearchTargets?.has(searchTarget));
          // Only need to request children count for indirect children search targets.
          // Direct children search targets already have children count stored in grouping nodes extended data.
          childrenCountMapObs = this.#props.idsCache.getAllChildrenCount({ elementIds: nestedSearchTargetElements }).pipe(
            map((elementCountMap) => {
              // Direct children search targets already have children count stored in grouping nodes extended data.
              node.extendedData.searchTargets?.forEach((value, key) => elementCountMap.set(key, value.childrenCount));
              return elementCountMap;
            }),
          );
        } else {
          childrenCountMapObs = this.#props.idsCache.getAllChildrenCount({ elementIds: searchTargetElements });
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
                    type: this.#elementType,
                    parentElementsIdsPath,
                    childrenCount: totalChildrenCount,
                    // Search results tree is created on search paths. Since search paths contain only categories that are directly under models
                    // or at the root, categoryId can be used here here.
                    categoryOfTopMostParentElement: categoryId,
                  });
                }),
              ),
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
        this.#props.idsCache.getModelCategoryIds(modelId).pipe(
          map((categories) => ({
            id: modelId,
            ...(this.#props.viewport.viewType === "2d" ? { drawingCategories: categories } : { spatialCategories: categories }),
          })),
        ),
      ),
    );
  }

  private getAllCategories(): ReturnType<BaseIdsCache["getAllCategories"]> {
    return this.#props.idsCache.getAllCategories().pipe(
      map((categories) => {
        if (this.#props.viewport.viewType === "2d") {
          return { drawingCategories: categories };
        }
        return { spatialCategories: categories };
      }),
    );
  }

  private getElementsCount(props: Parameters<BaseIdsCache["getElementsCount"]>[0]): ReturnType<BaseIdsCache["getElementsCount"]> {
    return this.#props.idsCache.getCategoryElementsCount(props.modelId, props.categoryId);
  }

  private getModels(props: Parameters<BaseIdsCache["getModels"]>[0]): ReturnType<BaseIdsCache["getModels"]> {
    return this.#props.idsCache.getCategoriesElementModels(props.categoryIds, true);
  }

  private getChildrenTree(props: Parameters<BaseIdsCache["getChildrenTree"]>[0]): ReturnType<BaseIdsCache["getChildrenTree"]> {
    return this.#props.idsCache.getChildrenTree({ elementIds: props.elementIds });
  }

  private getAllChildrenCount(props: Parameters<BaseIdsCache["getAllChildrenCount"]>[0]): ReturnType<BaseIdsCache["getAllChildrenCount"]> {
    return this.#props.idsCache.getAllChildrenCount({ elementIds: props.elementIds });
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
          return this.#props.idsCache.getModelCategoryIds(modelId).pipe(
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

/**
 * Creates categories tree visibility handler. Is used by integration and performance tests.
 * @internal
 */
export function createCategoriesTreeVisibilityHandler(props: {
  viewport: TreeWidgetViewport;
  idsCache: CategoriesTreeIdsCache;
  imodelAccess: ECClassHierarchyInspector;
  searchPaths?: HierarchySearchPath[];
  hierarchyConfig: CategoriesTreeHierarchyConfiguration;
}) {
  return new HierarchyVisibilityHandlerImpl<CategoriesTreeSearchTargets>({
    getSearchResultsTree: (): undefined | Promise<SearchResultsTree<CategoriesTreeSearchTargets>> => {
      if (!props.searchPaths) {
        return undefined;
      }
      const { categoryClass, elementClass, modelClass } = getClassesByView(props.viewport.viewType === "2d" ? "2d" : "3d");
      return createCategoriesSearchResultsTree({
        idsCache: props.idsCache,
        searchPaths: props.searchPaths,
        imodelAccess: props.imodelAccess,
        categoryClassName: categoryClass,
        categoryElementClassName: elementClass,
        categoryModelClassName: modelClass,
      });
    },
    getTreeSpecificVisibilityHandler: (info) => {
      return new CategoriesTreeVisibilityHandler({
        alwaysAndNeverDrawnElementInfo: info,
        idsCache: props.idsCache,
        viewport: props.viewport,
        hierarchyConfig: props.hierarchyConfig,
      });
    },
    viewport: props.viewport,
    componentId: Guid.createValue(),
  });
}
