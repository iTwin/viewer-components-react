/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { EMPTY, forkJoin, from, map, mergeMap, of, reduce } from "rxjs";
import { Guid } from "@itwin/core-bentley";
import { createSharedIdsProvider as createTreeDefinitionsSharedIdsProvider } from "@itwin/presentation-tree-definitions";
import { fromWithRelease, toObservable, toVoidPromise } from "../Rxjs.js";
import { ChildrenTree, extendObject, getOrCreate } from "../Utils.js";
import { CategoriesContainingParentElementsProvider } from "./CategoriesContainingParentElementsProvider.js";
import { ChildElementsProvider } from "./ChildElementsProvider.js";
import { DescendantsCountProvider } from "./DescendantsCountProvider.js";
import { loadSubModeledElements } from "./SubModeledElementsProvider.js";

import type { Observable } from "rxjs";
import type { Id64Set, Id64String } from "@itwin/core-bentley";
import type { LimitingECSqlQueryExecutor } from "@itwin/presentation-hierarchies";
import type { EC, ECSchemaProvider, Props, Subscribable } from "@itwin/presentation-shared";
import type { SharedIdsProvider as TreeDefinitionsSharedIdsProvider } from "@itwin/presentation-tree-definitions";
import type { CategoryId, ElementId, ModelId, SubCategoryId } from "../Types.js";
import type { ParentElementsPath } from "../Utils.js";
import type { SubModeledElementsData } from "./SubModeledElementsProvider.js";

type ElementModelCategoriesData = ReturnType<TreeDefinitionsSharedIdsProvider["models"]["getData"]> extends Subscribable<infer TData> ? TData : never;

interface ModelCategories {
  allCategories: Set<CategoryId>;
  categoriesOfTopMostElements: Set<CategoryId>;
}

interface CategoriesOfElementsInfo {
  modelCategories: Map<ModelId, ModelCategories>;
  allCategoriesOfTopMostElements: Set<CategoryId>;
}

/** @internal */
export interface SharedIdsProviderProps {
  imodelAccess: ECSchemaProvider & LimitingECSqlQueryExecutor;
  elementClassName: EC.FullClassNameDotNotation;
  excludedElementClassNames?: ReadonlyArray<EC.FullClassNameDotNotation>;
}

type TreeDefinitionsSharedIdsProviderBase = TreeDefinitionsSharedIdsProvider<ElementModelCategoriesData, SubModeledElementsData>;

/**
 * Provides model, category, sub-category and element IDs shared by tree specific ids providers and visibility handlers.
 *
 * Extends `@itwin/presentation-tree-definitions` shared ids provider with additional data required by tree widget.
 * @internal
 */
export interface SharedIdsProvider extends TreeDefinitionsSharedIdsProviderBase {
  readonly models: TreeDefinitionsSharedIdsProviderBase["models"] & {
    /** Starts loading model and category data, if it's not loaded yet. */
    preloadData(): Promise<void>;
    /** Emits a stream of models (excluding sub-models) that contain top-most elements of the specified category. */
    getCategoryTopMostElementModels(props: { categoryId: Id64String }): Observable<ModelId>;
  };
  readonly subModeledElements: TreeDefinitionsSharedIdsProviderBase["subModeledElements"] & {
    /** Starts loading sub-modeled elements data, if it's not loaded yet. */
    preloadData(): Promise<void>;
    /** Returns whether the specified model contains sub-modeled elements. */
    hasSubModels(props: { modelId: Id64String }): Observable<boolean>;
    /** Returns sub-models of the specified element, models and/or categories. */
    getSubModels(
      props:
        | { elementId: Id64String }
        | { modelIds: Id64Set; categoryIds?: undefined }
        | { categoryIds: Id64Set; modelIds?: undefined }
        | { modelIds: Id64Set; categoryIds: Id64Set; parentElementsPath: ParentElementsPath },
    ): Observable<Id64String>;
  };
  readonly categories: TreeDefinitionsSharedIdsProviderBase["categories"] & {
    /** Returns categories of elements in the specified model, including categories of elements of excluded classes. */
    getCategoriesOfElements(props: { modelId: Id64String; includeOnlyIfCategoryOfTopMostElement?: boolean }): Observable<Id64Set>;
    /** Returns whether the specified category contains elements that have child elements. */
    hasParentElements(props: { categoryId: Id64String }): Observable<boolean>;
    /** Returns categories of top-most elements, including categories of elements of excluded classes. */
    getAllCategoriesOfTopMostElements(): Observable<ReadonlySet<CategoryId>>;
  };
  readonly subCategories: TreeDefinitionsSharedIdsProviderBase["subCategories"] & {
    /** Returns sub-categories of the specified category. */
    getSubCategories(props: { categoryId: Id64String }): Observable<Array<SubCategoryId>>;
  };
  /** Element lookups. */
  readonly elements: {
    /** Returns whether elements may have children that are of excluded classes. */
    canHaveHiddenChildren(): boolean;
    getDescendantsCounts(props: Props<DescendantsCountProvider["getDescendantsCounts"]>): ReturnType<DescendantsCountProvider["getDescendantsCounts"]>;
    getChildElements(props: Props<ChildElementsProvider["getChildElements"]>): ReturnType<ChildElementsProvider["getChildElements"]>;
  };
}

/**
 * Creates `SharedIdsProvider`. Data is loaded, cached and tracked by `@itwin/presentation-tree-definitions` shared ids provider.
 * @internal
 */
export function createSharedIdsProvider(props: SharedIdsProviderProps): SharedIdsProvider {
  const { imodelAccess, elementClassName, excludedElementClassNames } = props;
  const componentId = Guid.createValue();
  const descendantsCountProvider = new DescendantsCountProvider({ elementClassName, componentId, queryExecutor: imodelAccess });
  const childElementsProvider = new ChildElementsProvider({ elementClassName, componentId, queryExecutor: imodelAccess });
  const categoriesContainingParentElementsProvider = new CategoriesContainingParentElementsProvider({
    elementClassName,
    componentId,
    queryExecutor: imodelAccess,
  });

  const treeDefinitionsSharedIdsProvider: TreeDefinitionsSharedIdsProviderBase = createTreeDefinitionsSharedIdsProvider({
    imodelAccess,
    elementClassName,
    excludedElementClassNames,
    loadDataOverrides: {
      loadSubModeledElements: () =>
        loadSubModeledElements({
          queryExecutor: imodelAccess,
          componentId,
          elementClassName,
          getNonEmptyModelIds: () => toObservable(treeDefinitionsSharedIdsProvider.models.getAllModels()),
        }),
    },
  });
  const { models, subModeledElements, categories, subCategories } = treeDefinitionsSharedIdsProvider;

  const getElementModelCategories = () => toObservable(models.getData());
  const getModeledElementsInfo = () => toObservable(subModeledElements.getData());

  // Keyed by data object, so that subscribers still go through (batched) `models.getData()`, but the mapping is computed only once.
  const categoriesOfElementsInfoCache = new WeakMap<ElementModelCategoriesData, CategoriesOfElementsInfo>();
  function getCategoriesOfElementsInfo(): Observable<CategoriesOfElementsInfo> {
    return getElementModelCategories().pipe(
      map((data) => {
        let categoriesOfElementsInfo = categoriesOfElementsInfoCache.get(data);
        if (!categoriesOfElementsInfo) {
          categoriesOfElementsInfo = createCategoriesOfElementsInfo(data.categoryModelsInfo);
          categoriesOfElementsInfoCache.set(data, categoriesOfElementsInfo);
        }
        return categoriesOfElementsInfo;
      }),
    );
  }

  function getCategoriesOfElements({
    modelId,
    includeOnlyIfCategoryOfTopMostElement,
  }: {
    modelId: Id64String;
    includeOnlyIfCategoryOfTopMostElement?: boolean;
  }): Observable<Id64Set> {
    return getCategoriesOfElementsInfo().pipe(
      map(({ modelCategories }) => {
        const entry = modelCategories.get(modelId);
        return (includeOnlyIfCategoryOfTopMostElement ? entry?.categoriesOfTopMostElements : entry?.allCategories) ?? new Set();
      }),
    );
  }

  function getCategoryTopMostElementModels({ categoryId }: { categoryId: Id64String }): Observable<ModelId> {
    return toObservable(subModeledElements.getAllSubModeledElements()).pipe(
      mergeMap((excludedSubModels) => toObservable(models.getModels({ categoryId, excludedSubModels, includeOnlyTopMostElementCategory: true }))),
    );
  }

  function hasSubModels({ modelId }: { modelId: Id64String }): Observable<boolean> {
    return getModeledElementsInfo().pipe(map(({ subModelsTree }) => subModelsTree.has(modelId)));
  }

  function getCategoryModeledElements({
    modelIds,
    categoryIds,
    parentElementsPath,
  }: {
    modelIds: Id64Set;
    categoryIds: Id64Set;
    parentElementsPath: ParentElementsPath;
  }): Observable<Id64String> {
    return getModeledElementsInfo().pipe(
      mergeMap(({ subModelsTree }) => {
        const accumulator = new Array<ElementId>();
        const childrenTreeAsArray = new Array<Set<ElementId | CategoryId | ModelId>>();
        childrenTreeAsArray.push(modelIds);
        for (const { categoryIds: parentCategoryId, elementIds } of parentElementsPath) {
          childrenTreeAsArray.push(new Set([parentCategoryId]));
          childrenTreeAsArray.push(new Set(elementIds));
        }
        childrenTreeAsArray.push(categoryIds);
        ChildrenTree.visit({
          tree: subModelsTree,
          accept: ({ treeEntry, key, depth }) => {
            if (depth < childrenTreeAsArray.length) {
              // when entry in children tree does not exist in the childrenTreeAsArray
              // it means that this branch of the tree is not in the path specified by parentElementsPath
              // children can be ignored
              if (!childrenTreeAsArray[depth].has(key)) {
                return { ignoreChildren: true };
              }
              if (depth === childrenTreeAsArray.length - 1) {
                accumulator.push(...treeEntry.directSubModels);
              }
              return { ignoreChildren: false };
            }
            accumulator.push(...treeEntry.directSubModels);
            return { ignoreChildren: false };
          },
        });
        return accumulator;
      }),
    );
  }

  function getSubModels(functionProps: Parameters<SharedIdsProvider["subModeledElements"]["getSubModels"]>[0]): Observable<Id64String> {
    if ("elementId" in functionProps) {
      return getModeledElementsInfo().pipe(
        mergeMap(({ allSubModels, childSubModels }) => {
          if (allSubModels.has(functionProps.elementId)) {
            // If element is a sub-model, it can not be a parent.
            return of(functionProps.elementId);
          }
          // When element does not contain sub-model, return empty array.
          return childSubModels.get(functionProps.elementId) ?? EMPTY;
        }),
      );
    }
    if (functionProps.modelIds) {
      if (functionProps.categoryIds) {
        return getCategoryModeledElements({
          modelIds: functionProps.modelIds,
          categoryIds: functionProps.categoryIds,
          parentElementsPath: functionProps.parentElementsPath,
        });
      }
      return from(functionProps.modelIds).pipe(
        mergeMap((modelId) =>
          hasSubModels({ modelId }).pipe(
            mergeMap((hasModeledElements) => {
              if (!hasModeledElements) {
                return of([]);
              }
              return getCategoriesOfElements({ modelId });
            }),
          ),
        ),
        reduce((acc, categoryIds) => {
          for (const categoryId of categoryIds) {
            acc.add(categoryId);
          }
          return acc;
        }, new Set<CategoryId>()),
        mergeMap((categoryIds) => {
          if (categoryIds.size === 0) {
            return EMPTY;
          }
          return getCategoryModeledElements({ modelIds: functionProps.modelIds, categoryIds, parentElementsPath: [] });
        }),
      );
    }

    return fromWithRelease({ source: functionProps.categoryIds, releaseOnCount: 100 }).pipe(
      mergeMap((categoryId) =>
        getCategoryTopMostElementModels({ categoryId }).pipe(
          mergeMap((modelId) => forkJoin({ hasModeledElements: hasSubModels({ modelId }), modelId: of(modelId) })),
          reduce((acc, { hasModeledElements, modelId }) => {
            if (hasModeledElements) {
              acc.add(modelId);
            }
            return acc;
          }, new Set<ModelId>()),
          mergeMap((modelIds) => {
            if (modelIds.size === 0) {
              return EMPTY;
            }
            return getCategoryModeledElements({ modelIds, categoryIds: new Set([categoryId]), parentElementsPath: [] });
          }),
        ),
      ),
    );
  }

  return extendObject({
    base: treeDefinitionsSharedIdsProvider,
    extension: {
      models: extendObject({
        base: models,
        extension: {
          preloadData: async () => {
            if (models.state !== "not-requested") {
              return;
            }
            try {
              await toVoidPromise(getElementModelCategories());
            } catch {}
          },
          getCategoryTopMostElementModels,
        },
      }),
      subModeledElements: extendObject({
        base: subModeledElements,
        extension: {
          preloadData: async () => {
            if (subModeledElements.state !== "not-requested") {
              return;
            }
            try {
              await toVoidPromise(getModeledElementsInfo());
            } catch {}
          },
          hasSubModels,
          getSubModels,
        },
      }),
      categories: extendObject({
        base: categories,
        extension: {
          getCategoriesOfElements,
          getAllCategoriesOfTopMostElements: () =>
            getCategoriesOfElementsInfo().pipe(map(({ allCategoriesOfTopMostElements }) => allCategoriesOfTopMostElements)),
          hasParentElements: ({ categoryId }: { categoryId: Id64String }) =>
            categoriesContainingParentElementsProvider.categoryHasParentElements({ categoryId }),
        },
      }),
      subCategories: extendObject({
        base: subCategories,
        extension: {
          getSubCategories: ({ categoryId }: { categoryId: Id64String }) =>
            toObservable(subCategories.getData()).pipe(map(({ categorySubCategories }) => categorySubCategories.get(categoryId) ?? [])),
        },
      }),
      elements: {
        canHaveHiddenChildren: () => !!excludedElementClassNames?.length,
        getDescendantsCounts: (descendantsCountProps: Props<DescendantsCountProvider["getDescendantsCounts"]>) =>
          descendantsCountProvider.getDescendantsCounts(descendantsCountProps),
        getChildElements: (childElementsProps: Props<ChildElementsProvider["getChildElements"]>) => childElementsProvider.getChildElements(childElementsProps),
      },
    },
  });
}

function createCategoriesOfElementsInfo(categoryModelsInfo: ElementModelCategoriesData["categoryModelsInfo"]): CategoriesOfElementsInfo {
  const result: CategoriesOfElementsInfo = { modelCategories: new Map(), allCategoriesOfTopMostElements: new Set() };
  for (const [categoryId, categoryModels] of categoryModelsInfo) {
    for (const { id: modelId, categoryIsOfTopMostElement } of categoryModels) {
      const entry = getOrCreate({
        map: result.modelCategories,
        key: modelId,
        createFunc: (): ModelCategories => ({ allCategories: new Set(), categoriesOfTopMostElements: new Set() }),
      });
      entry.allCategories.add(categoryId);
      if (categoryIsOfTopMostElement) {
        entry.categoriesOfTopMostElements.add(categoryId);
        result.allCategoriesOfTopMostElements.add(categoryId);
      }
    }
  }
  return result;
}
