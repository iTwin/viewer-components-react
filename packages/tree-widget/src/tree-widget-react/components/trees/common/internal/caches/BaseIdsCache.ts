/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { EMPTY, filter, forkJoin, from, identity, map, mergeMap, of, reduce, shareReplay } from "rxjs";
import { Guid } from "@itwin/core-bentley";
import { fromWithRelease } from "../Rxjs.js";
import { ChildrenTree, getOrCreate } from "../Utils.js";
import { ChildElementsCache } from "./ChildElementsCache.js";
import { DescendantsCountCache } from "./DescendantsCountCache.js";
import { ElementModelCategoriesCache } from "./ElementModelCategoriesCache.js";
import { ModeledElementsCache } from "./ModeledElementsCache.js";
import { SubCategoriesCache } from "./SubCategoriesCache.js";

import type { Observable } from "rxjs";
import type { GuidString, Id64Arg, Id64Set, Id64String } from "@itwin/core-bentley";
import type { LimitingECSqlQueryExecutor } from "@itwin/presentation-hierarchies";
import type { EC, Props } from "@itwin/presentation-shared";
import type { CategoryId, ElementId, ModelId, SubCategoryId } from "../Types.js";
import type { ParentElementsPath } from "../Utils.js";

/** @internal */
export interface BaseIdsCacheProps {
  queryExecutor: LimitingECSqlQueryExecutor;
  elementClassName: EC.FullClassNameDotNotation;
  type: "2d" | "3d";
  excludedElementClassNames?: ReadonlyArray<EC.FullClassNameDotNotation>;
}

/** @internal */
export class BaseIdsCache {
  #queryExecutor: LimitingECSqlQueryExecutor;
  #componentId: GuidString;
  readonly #descendantsCountCache: DescendantsCountCache;
  readonly #childElementsCache: ChildElementsCache;
  readonly #subCategoriesCache: SubCategoriesCache;
  #elementClassName: EC.FullClassNameDotNotation;
  #modeledElementsCache: Observable<ModeledElementsCache> | undefined;
  readonly #elementModelCategoriesCache: ElementModelCategoriesCache;
  #categoryModelsInfoWithoutSubModels:
    | Observable<
        Map<
          CategoryId,
          {
            id: ModelId;
            categoryIsOfTopMostElement: boolean;
            hasNonExcludedTopMostElements: boolean;
          }[]
        >
      >
    | undefined;
  #subModelsWithNonExcludedElements: Observable<Set<ModelId>> | undefined;
  #canHaveHiddenChildren: boolean;

  constructor(props: BaseIdsCacheProps) {
    this.#queryExecutor = props.queryExecutor;
    this.#elementClassName = props.elementClassName;
    this.#componentId = Guid.createValue();
    this.#descendantsCountCache = new DescendantsCountCache({
      elementClassName: props.elementClassName,
      componentId: this.#componentId,
      queryExecutor: this.#queryExecutor,
    });
    this.#childElementsCache = new ChildElementsCache({
      queryExecutor: this.#queryExecutor,
      elementClassName: props.elementClassName,
      componentId: this.#componentId,
    });
    this.#subCategoriesCache = new SubCategoriesCache({
      queryExecutor: this.#queryExecutor,
      componentId: this.#componentId,
    });
    this.#elementModelCategoriesCache = new ElementModelCategoriesCache({
      queryExecutor: this.#queryExecutor,
      componentId: this.#componentId,
      elementClassName: props.elementClassName,
      excludedElementClassNames: props.excludedElementClassNames,
    });
    this.#canHaveHiddenChildren = !!props.excludedElementClassNames?.length;
  }

  private getModeledElementsInfo(): ReturnType<ModeledElementsCache["getModeledElementsInfo"]> {
    this.#modeledElementsCache ??= this.getAllModels().pipe(
      map(
        (allModels) =>
          new ModeledElementsCache({
            queryExecutor: this.#queryExecutor,
            componentId: this.#componentId,
            elementClassName: this.#elementClassName,
            nonEmptyModelIds: allModels,
          }),
      ),
      shareReplay(),
    );
    return this.#modeledElementsCache.pipe(mergeMap((modeledElementsCache) => modeledElementsCache.getModeledElementsInfo()));
  }

  // Implement methods using each cache

  // ModeledElementsCache methods
  public getCategoryModeledElements({
    modelIds,
    categoryIds,
    parentElementsPath,
  }: {
    modelIds: Id64Set;
    categoryIds: Id64Set;
    parentElementsPath: ParentElementsPath;
  }): Observable<Id64String> {
    return this.getModeledElementsInfo().pipe(
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

  public hasSubModels({ modelId }: { modelId: Id64String }): Observable<boolean> {
    return this.getModeledElementsInfo().pipe(map(({ subModelsTree }) => subModelsTree.has(modelId)));
  }

  public getAllSubModels(props?: { excludeIfOnlyExcludedClasses?: boolean }): Observable<Id64Set> {
    if (!props?.excludeIfOnlyExcludedClasses) {
      return this.getModeledElementsInfo().pipe(map(({ allSubModels }) => allSubModels));
    }
    this.#subModelsWithNonExcludedElements ??= this.getModeledElementsInfo().pipe(
      mergeMap(({ allSubModels }) => {
        if (allSubModels.size === 0) {
          return of(allSubModels);
        }
        return this.#elementModelCategoriesCache.getCachedData().pipe(
          map(({ modelsCategoriesInfo }) => {
            const result = new Set<ElementId>();
            for (const subModelId of allSubModels) {
              const modelInfo = modelsCategoriesInfo.get(subModelId);
              if (modelInfo && modelInfo.nonExcludedCategories.size > 0) {
                result.add(subModelId);
              }
            }
            return result;
          }),
        );
      }),
      shareReplay(),
    );
    return this.#subModelsWithNonExcludedElements;
  }

  public getSubModels(
    props:
      | { elementId: Id64String }
      | { modelIds: Id64Set; categoryIds?: undefined }
      | { categoryIds: Id64Set; modelIds?: undefined }
      | { modelIds: Id64Set; categoryIds: Id64Set; parentElementsPath: ParentElementsPath },
  ): Observable<Id64String> {
    if ("elementId" in props) {
      return this.getModeledElementsInfo().pipe(
        mergeMap(({ allSubModels, childSubModels }) => {
          if (allSubModels.has(props.elementId)) {
            // If element is a sub-model, it can not be a parent.
            return of(props.elementId);
          }
          // Convert sub-models set into array.
          // When element does not contain sub-model, return empty array.
          return childSubModels.get(props.elementId) ?? EMPTY;
        }),
      );
    }
    if (props.modelIds) {
      if (props.categoryIds) {
        return this.getCategoryModeledElements({
          modelIds: props.modelIds,
          categoryIds: props.categoryIds,
          parentElementsPath: props.parentElementsPath,
        });
      }
      return from(props.modelIds).pipe(
        mergeMap((modelId) =>
          this.hasSubModels({ modelId }).pipe(
            mergeMap((hasModeledElements) => {
              if (!hasModeledElements) {
                return of([]);
              }
              return this.getCategories({ modelId });
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
          return this.getCategoryModeledElements({ modelIds: props.modelIds, categoryIds, parentElementsPath: [] });
        }),
      );
    }

    return fromWithRelease({ source: props.categoryIds, releaseOnCount: 100 }).pipe(
      mergeMap((categoryId) =>
        this.getModels({ categoryId, excludeSubModels: true, includeOnlyTopMostElementCategory: true }).pipe(
          mergeMap((modelId) => forkJoin({ hasModeledElements: this.hasSubModels({ modelId }), modelId: of(modelId) })),
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
            return this.getCategoryModeledElements({ modelIds, categoryIds: new Set([categoryId]), parentElementsPath: [] });
          }),
        ),
      ),
    );
  }

  // ElementModelCategoriesCache methods

  public elementModelCategoriesLoaded(): boolean {
    return this.#elementModelCategoriesCache.cachedDataLoaded();
  }

  public getAllModels(): Observable<Array<ModelId>> {
    return this.#elementModelCategoriesCache.getCachedData().pipe(map(({ modelsCategoriesInfo }) => [...modelsCategoriesInfo.keys()]));
  }

  public getPlanProjectionModels(): Observable<Id64Set> {
    return this.#elementModelCategoriesCache.getCachedData().pipe(
      map(({ modelsCategoriesInfo }) => {
        const result = new Set<ModelId>();
        for (const [modelId, modelInfo] of modelsCategoriesInfo) {
          if (modelInfo.isPlanProjectionModel) {
            result.add(modelId);
          }
        }
        return result;
      }),
    );
  }

  public getCategories({
    modelId,
    includeOnlyIfCategoryOfTopMostElement,
    excludeIfOnlyExcludedClasses,
  }: {
    modelId: Id64String;
    includeOnlyIfCategoryOfTopMostElement?: boolean;
    excludeIfOnlyExcludedClasses?: boolean;
  }): Observable<Id64Set> {
    return this.#elementModelCategoriesCache.getCachedData().pipe(
      map(({ modelsCategoriesInfo }) => {
        const modelInfo = modelsCategoriesInfo.get(modelId);
        if (excludeIfOnlyExcludedClasses) {
          return (includeOnlyIfCategoryOfTopMostElement ? modelInfo?.categoriesOfTopMostNonExcludedElements : modelInfo?.nonExcludedCategories) ?? new Set();
        }
        return (includeOnlyIfCategoryOfTopMostElement ? modelInfo?.categoriesOfTopMostElements : modelInfo?.allCategories) ?? new Set();
      }),
    );
  }

  public getModelsContainingNonExcludedElements(): Observable<Id64Set> {
    return this.#elementModelCategoriesCache
      .getCachedData()
      .pipe(map(({ modelsContainingTopMostNonExcludedElements }) => modelsContainingTopMostNonExcludedElements));
  }

  public getCategoriesContainingNonExcludedElements(): Observable<Id64Set> {
    return this.#elementModelCategoriesCache
      .getCachedData()
      .pipe(map(({ categoriesContainingNonExcludedElements }) => categoriesContainingNonExcludedElements));
  }

  public getAllCategoriesOfElements(props?: { onlyTopMostElementCategories?: boolean }): Observable<Id64Set> {
    return this.#elementModelCategoriesCache
      .getCachedData()
      .pipe(map(({ allCategories, allTopMostElementCategories }) => (props?.onlyTopMostElementCategories ? allTopMostElementCategories : allCategories)));
  }

  private getCategoryModelsInfoWithoutSubModels(): Observable<
    Map<CategoryId, { id: ModelId; categoryIsOfTopMostElement: boolean; hasNonExcludedTopMostElements: boolean }[]>
  > {
    this.#categoryModelsInfoWithoutSubModels ??= this.getAllSubModels().pipe(
      mergeMap((allSubModels) =>
        allSubModels.size === 0
          ? this.#elementModelCategoriesCache.getCachedData().pipe(map(({ categoryModelsInfo }) => categoryModelsInfo))
          : this.#elementModelCategoriesCache.getCachedData().pipe(
              mergeMap(({ categoryModelsInfo }) => categoryModelsInfo.entries()),
              reduce((acc, [key, modelInfos]) => {
                const newModelInfos = modelInfos.filter(({ id }) => !allSubModels.has(id));
                if (newModelInfos.length > 0) {
                  acc.set(key, newModelInfos);
                }
                return acc;
              }, new Map<CategoryId, { id: ModelId; categoryIsOfTopMostElement: boolean; hasNonExcludedTopMostElements: boolean }[]>()),
            ),
      ),
      shareReplay(),
    );
    return this.#categoryModelsInfoWithoutSubModels;
  }

  public getModels({
    categoryId,
    excludeSubModels,
    includeOnlyTopMostElementCategory,
    excludeIfOnlyExcludedClasses,
  }: {
    categoryId: Id64String;
    excludeSubModels?: boolean;
    includeOnlyTopMostElementCategory?: boolean;
    excludeIfOnlyExcludedClasses?: boolean;
  }): Observable<ModelId> {
    let getCategoryModelsInfo = () => this.#elementModelCategoriesCache.getCachedData().pipe(map(({ categoryModelsInfo }) => categoryModelsInfo));

    if (excludeSubModels) {
      getCategoryModelsInfo = () => this.getCategoryModelsInfoWithoutSubModels();
    }
    return getCategoryModelsInfo().pipe(
      mergeMap((categoryModelsInfo) => {
        const categoryModels = categoryModelsInfo.get(categoryId);
        if (!categoryModels) {
          return EMPTY;
        }
        return from(categoryModels);
      }),
      includeOnlyTopMostElementCategory ? filter(({ categoryIsOfTopMostElement }) => categoryIsOfTopMostElement) : identity,
      excludeIfOnlyExcludedClasses ? filter(({ hasNonExcludedTopMostElements }) => hasNonExcludedTopMostElements) : identity,
      map(({ id }) => id),
    );
  }

  public categoryHasParentElements({ categoryId }: { categoryId: Id64String }): Observable<boolean> {
    return this.#elementModelCategoriesCache.getCachedData().pipe(map(({ categoriesWithParentElements }) => categoriesWithParentElements.has(categoryId)));
  }

  // DescendantsCountCache methods

  public getDescendantsCounts(props: Props<DescendantsCountCache["getDescendantsCounts"]>): ReturnType<DescendantsCountCache["getDescendantsCounts"]> {
    return this.#descendantsCountCache.getDescendantsCounts(props);
  }

  // ChildElementsCache methods

  public getChildElements(props: Props<ChildElementsCache["getChildElements"]>): ReturnType<ChildElementsCache["getChildElements"]> {
    return this.#childElementsCache.getChildElements(props);
  }

  // SubCategoriesCache methods
  public getSubCategories(props: { categoryId: Id64String }): Observable<Array<SubCategoryId>> {
    return this.#subCategoriesCache.getSubCategoriesInfo().pipe(map(({ categorySubCategories }) => categorySubCategories.get(props.categoryId) ?? []));
  }

  public getCategorySubCategoriesMap(): Observable<Map<CategoryId, SubCategoryId[]>> {
    return this.#subCategoriesCache.getSubCategoriesInfo().pipe(map(({ categorySubCategories }) => categorySubCategories));
  }

  public getSubCategoryCategories({
    subCategoryIds,
    checkForSubCategoriesSize,
  }: {
    subCategoryIds: Id64Arg;
    checkForSubCategoriesSize: boolean;
  }): Observable<Map<CategoryId, SubCategoryId[]>> {
    return this.#subCategoriesCache.getSubCategoriesInfo().pipe(
      mergeMap(({ subCategoryCategories, categorySubCategories }) =>
        fromWithRelease({ source: subCategoryIds, releaseOnCount: 500 }).pipe(
          reduce((acc, subCategoryId) => {
            const categoryId = subCategoryCategories.get(subCategoryId);
            if (!checkForSubCategoriesSize || categoryId === undefined) {
              return acc;
            }
            const subCategories = categorySubCategories.get(categoryId);
            if (!subCategories || subCategories.length <= 1) {
              return acc;
            }
            const entry = getOrCreate({ map: acc, key: categoryId, createFunc: () => new Array<SubCategoryId>() });
            entry.push(subCategoryId);
            return acc;
          }, new Map<CategoryId, SubCategoryId[]>()),
        ),
      ),
    );
  }

  public canHaveHiddenChildren(): boolean {
    return this.#canHaveHiddenChildren;
  }
}

/** @internal */
export interface BaseIdsCacheImplProps {
  baseIdsCache: BaseIdsCache;
}

/** @internal */
export class BaseIdsCacheImpl {
  #baseIdsCache: BaseIdsCache;
  constructor(props: BaseIdsCacheImplProps) {
    this.#baseIdsCache = props.baseIdsCache;
  }

  // Implement IBaseIdsCache by re-exporting BaseIdsCache methods

  public getChildElements(props: Props<BaseIdsCache["getChildElements"]>): ReturnType<BaseIdsCache["getChildElements"]> {
    return this.#baseIdsCache.getChildElements(props);
  }

  public getSubCategories(props: Props<BaseIdsCache["getSubCategories"]>): ReturnType<BaseIdsCache["getSubCategories"]> {
    return this.#baseIdsCache.getSubCategories(props);
  }

  public getSubCategoryCategories(props: Props<BaseIdsCache["getSubCategoryCategories"]>): ReturnType<BaseIdsCache["getSubCategoryCategories"]> {
    return this.#baseIdsCache.getSubCategoryCategories(props);
  }

  public getSubModels(props: Props<BaseIdsCache["getSubModels"]>): ReturnType<BaseIdsCache["getSubModels"]> {
    return this.#baseIdsCache.getSubModels(props);
  }

  public getAllSubModels(props?: Props<BaseIdsCache["getAllSubModels"]>): ReturnType<BaseIdsCache["getAllSubModels"]> {
    return this.#baseIdsCache.getAllSubModels(props);
  }

  public getModelsContainingNonExcludedElements(): ReturnType<BaseIdsCache["getModelsContainingNonExcludedElements"]> {
    return this.#baseIdsCache.getModelsContainingNonExcludedElements();
  }

  public getCategoriesContainingNonExcludedElements(): ReturnType<BaseIdsCache["getCategoriesContainingNonExcludedElements"]> {
    return this.#baseIdsCache.getCategoriesContainingNonExcludedElements();
  }

  public hasSubModels(props: Props<BaseIdsCache["hasSubModels"]>): ReturnType<BaseIdsCache["hasSubModels"]> {
    return this.#baseIdsCache.hasSubModels(props);
  }

  public getDescendantsCounts(props: Props<BaseIdsCache["getDescendantsCounts"]>): ReturnType<BaseIdsCache["getDescendantsCounts"]> {
    return this.#baseIdsCache.getDescendantsCounts(props);
  }

  public getCategories(props: Props<BaseIdsCache["getCategories"]>): ReturnType<BaseIdsCache["getCategories"]> {
    return this.#baseIdsCache.getCategories(props);
  }

  public getModels(props: Props<BaseIdsCache["getModels"]>): ReturnType<BaseIdsCache["getModels"]> {
    return this.#baseIdsCache.getModels(props);
  }

  public categoryHasParentElements(props: Props<BaseIdsCache["categoryHasParentElements"]>): ReturnType<BaseIdsCache["categoryHasParentElements"]> {
    return this.#baseIdsCache.categoryHasParentElements(props);
  }

  public getAllCategoriesOfElements(props?: Props<BaseIdsCache["getAllCategoriesOfElements"]>): ReturnType<BaseIdsCache["getAllCategoriesOfElements"]> {
    return this.#baseIdsCache.getAllCategoriesOfElements(props);
  }

  public canHaveHiddenChildren(): ReturnType<BaseIdsCache["canHaveHiddenChildren"]> {
    return this.#baseIdsCache.canHaveHiddenChildren();
  }

  public getCategorySubCategoriesMap(): ReturnType<BaseIdsCache["getCategorySubCategoriesMap"]> {
    return this.#baseIdsCache.getCategorySubCategoriesMap();
  }
}
