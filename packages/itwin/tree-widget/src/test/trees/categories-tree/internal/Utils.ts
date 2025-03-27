/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { expect } from "chai";
import sinon from "sinon";
import { BeEvent, Id64 } from "@itwin/core-bentley";
import { PerModelCategoryVisibility } from "@itwin/core-frontend";
import { getDistinctMapValues } from "../../../../tree-widget-react/components/trees/common/internal/Utils.js";

import type { Id64Arg, Id64Array, Id64Set, Id64String } from "@itwin/core-bentley";
import type { IModelConnection, Viewport } from "@itwin/core-frontend";
import type { ClassGroupingNodeKey, GroupingHierarchyNode, HierarchyNodeKey, NonGroupingHierarchyNode } from "@itwin/presentation-hierarchies";
import type { CategoriesTreeIdsCache } from "../../../../tree-widget-react/components/trees/categories-tree/internal/CategoriesTreeIdsCache.js";

/** @internal */
export function createCategoryHierarchyNode(categoryId: Id64String, hasChildren = false): NonGroupingHierarchyNode {
  return {
    key: {
      type: "instances",
      instanceKeys: [{ className: "bis:SpatialCategory", id: categoryId }],
    },
    children: hasChildren,
    label: "",
    parentKeys: [],
    extendedData: {
      isCategory: true,
    },
  };
}

/** @internal */
export function createSubModelCategoryHierarchyNode(modelId?: Id64String, categoryId?: Id64String, hasChildren?: boolean): NonGroupingHierarchyNode {
  return {
    key: {
      type: "instances",
      instanceKeys: [{ className: "bis:SpatialCategory", id: categoryId ?? "" }],
    },
    children: !!hasChildren,
    label: "",
    parentKeys: [],
    extendedData: {
      isCategory: true,
      modelId: modelId ?? "0x1",
      categoryId: categoryId ?? "0x2",
    },
  };
}
/** @internal */
export function createSubCategoryHierarchyNode(subCategoryId: Id64String, categoryId: Id64String): NonGroupingHierarchyNode {
  return {
    key: {
      type: "instances",
      instanceKeys: [{ className: "bis:SubCategory", id: subCategoryId }],
    },
    children: false,
    label: "",
    parentKeys: [],
    extendedData: {
      isSubCategory: true,
      categoryId,
    },
  };
}

/** @internal */
export function createClassGroupingHierarchyNode({
  modelElementsMap,
  parentKeys,
  ...props
}: {
  categoryId: Id64String | undefined;
  modelElementsMap: Map<Id64String, Id64Array>;
  className?: string;
  parentKeys?: HierarchyNodeKey[];
}): GroupingHierarchyNode & { key: ClassGroupingNodeKey } {
  const className = props.className ?? "Bis:Element";
  return {
    key: {
      type: "class-grouping",
      className,
    },
    children: !!modelElementsMap.size,
    groupedInstanceKeys: [...getDistinctMapValues(modelElementsMap)].map((elementId) => ({ className, id: elementId })),
    label: "",
    parentKeys: parentKeys ?? [],
    extendedData: {
      categoryId: props.categoryId,
      modelElementsMap,
    },
  };
}

/** @internal */
export function createDefinitionContainerHierarchyNode(definitionContainerId: Id64String): NonGroupingHierarchyNode {
  return {
    key: {
      type: "instances",
      instanceKeys: [{ className: "bis:DefinitionContainer", id: definitionContainerId }],
    },
    children: true,
    label: "",
    parentKeys: [],
    extendedData: {
      isDefinitionContainer: true,
    },
  };
}

/** @internal */
export function createElementHierarchyNode(props: {
  modelId: Id64String | undefined;
  categoryId: Id64String | undefined;
  hasChildren?: boolean;
  elementId?: Id64String;
}): NonGroupingHierarchyNode {
  return {
    key: {
      type: "instances",
      instanceKeys: [{ className: "bis:GeometricalElement3d", id: props.elementId ?? "" }],
    },
    children: !!props.hasChildren,
    label: "",
    parentKeys: [],
    extendedData: {
      modelId: props.modelId,
      categoryId: props.categoryId,
    },
  };
}

interface ViewportStubValidation {
  /**
   * Checks if `changeCategoryDisplay` and `changeSubCategoryDisplay` get called with appropriate params
   *
   * @param categories categories parameters that `changeCategoryDisplay` should be called with
   * @param subCategories subcategories parameters that `changeSubCategoryDisplay` should be called with
   */
  validateChangesCalls: (
    categories: { categoriesToChange: Id64Array; isVisible: boolean; enableAllSubCategories: boolean }[],
    subCategories: { subCategoryId: Id64String; isVisible: boolean }[],
  ) => void;
}

/**
 * Creates a stubbed `Viewport` with that has only necessary properties defined for determening CategoriesTree visibility.
 *
 * This stub allows changing and saving the display of categories and subcategories
 * @returns stubbed `Viewport`
 */
export async function createViewportStub(props: {
  idsCache: CategoriesTreeIdsCache;
  isVisibleOnInitialize: boolean;
  imodel: IModelConnection;
}): Promise<Viewport & ViewportStubValidation> {
  const subCategoriesMap = new Map<Id64String, boolean>();

  const categoriesMap = new Map<
    Id64String,
    {
      subCategories: Id64Array;
      isVisible: boolean;
    }
  >();
  const alwaysDrawn = new Set<Id64String>();
  const neverDrawn = new Set<Id64String>();

  const modelCategoriesOverrides = new Map<Id64String, Map<Id64String, PerModelCategoryVisibility.Override>>();

  const { categories: categoriesFromCache } = await props.idsCache.getAllDefinitionContainersAndCategories();
  const categorySubCategoriesMap = await props.idsCache.getSubCategories(categoriesFromCache);
  for (const [category, subCategoriesFromCache] of categorySubCategoriesMap) {
    subCategoriesFromCache.forEach((subCategoryId) => {
      subCategoriesMap.set(subCategoryId, props.isVisibleOnInitialize);
    });
    categoriesMap.set(category, { isVisible: props.isVisibleOnInitialize, subCategories: subCategoriesFromCache });
  }
  for (const categoryFromCache of categoriesFromCache) {
    if (!categoriesMap.has(categoryFromCache)) {
      categoriesMap.set(categoryFromCache, { isVisible: props.isVisibleOnInitialize, subCategories: [] });
    }
  }

  const changeCategoryDisplayStub = sinon.stub().callsFake((categoriesToChange: Id64Array, isVisible: boolean, enableAllSubCategories: boolean) => {
    for (const category of categoriesToChange) {
      const value = categoriesMap.get(category);
      if (value) {
        value.isVisible = isVisible;
        if (enableAllSubCategories) {
          for (const subCategory of value.subCategories) {
            subCategoriesMap.set(subCategory, true);
          }
        }
      } else {
        categoriesMap.set(category, { isVisible, subCategories: [] });
      }
    }
  });

  const changeSubCategoryDisplayStub = sinon.stub().callsFake((subCategoryId: Id64String, isVisible: boolean) => {
    subCategoriesMap.set(subCategoryId, isVisible);
  });

  return {
    isSubCategoryVisible: sinon.stub().callsFake((subCategoryId: Id64String) => !!subCategoriesMap.get(subCategoryId)),
    iModel: props.imodel,
    view: {
      viewsCategory: sinon.stub().callsFake((categoryId: Id64String) => {
        return !!categoriesMap.get(categoryId)?.isVisible;
      }),
      is2d: () => false,
      viewsModel: () => true,
    },
    addViewedModels: async () => {},
    changeModelDisplay: (modelIds: Id64Arg, on: boolean) => {
      for (const modelId of Id64.iterable(modelIds)) {
        const modelEntry = modelCategoriesOverrides.get(modelId);
        for (const [category, _] of modelEntry ?? []) {
          modelEntry?.set(category, on ? PerModelCategoryVisibility.Override.Show : PerModelCategoryVisibility.Override.Hide);
        }
      }
    },
    changeSubCategoryDisplay: changeSubCategoryDisplayStub,
    changeCategoryDisplay: changeCategoryDisplayStub,
    setAlwaysDrawn: (elements: Id64Set, _?: boolean) => {
      for (const element of elements) {
        alwaysDrawn.add(element);
        neverDrawn.delete(element);
      }
    },
    setNeverDrawn: (elements: Id64Set) => {
      for (const element of elements) {
        neverDrawn.add(element);
        alwaysDrawn.delete(element);
      }
    },
    isAlwaysDrawnExclusive: false,
    alwaysDrawn,
    neverDrawn,
    perModelCategoryVisibility: {
      getOverride: (modelId: Id64String, categoryId: Id64String) => {
        const override = modelCategoriesOverrides.get(modelId)?.get(categoryId);
        if (override !== undefined) {
          return override;
        }
        return PerModelCategoryVisibility.Override.None;
      },
      setOverride: (modelIds: Id64Arg, categoryIds: Id64Arg, override: PerModelCategoryVisibility.Override) => {
        for (const modelId of Id64.iterable(modelIds)) {
          let modelEntry = modelCategoriesOverrides.get(modelId);
          if (!modelEntry) {
            modelEntry = new Map();
            modelCategoriesOverrides.set(modelId, modelEntry);
          }
          for (const categoryId of Id64.iterable(categoryIds)) {
            if (override === PerModelCategoryVisibility.Override.None) {
              modelEntry.delete(categoryId);
            } else {
              modelEntry.set(categoryId, override);
            }
          }
        }
      },
      clearOverrides: (modelIds?: Id64Arg) => {
        if (!modelIds) {
          modelCategoriesOverrides.clear();
          return;
        }
        for (const modelId of Id64.iterable(modelIds)) {
          modelCategoriesOverrides.delete(modelId);
        }
      },
      *[Symbol.iterator](): Iterator<{ modelId: Id64String; categoryId: Id64String; visible: boolean }> {
        for (const [modelId, categoriesOverridesMap] of modelCategoriesOverrides) {
          for (const [categoryId, categoryOverride] of categoriesOverridesMap) {
            yield { modelId, categoryId, visible: categoryOverride === PerModelCategoryVisibility.Override.Show };
          }
        }
      },
    },
    onDisplayStyleChanged: new BeEvent<() => void>(),
    onViewedCategoriesChanged: new BeEvent<() => void>(),
    onViewedCategoriesPerModelChanged: new BeEvent<() => void>(),
    onViewedModelsChanged: new BeEvent<() => void>(),
    onAlwaysDrawnChanged: new BeEvent<() => void>(),
    onNeverDrawnChanged: new BeEvent<() => void>(),
    validateChangesCalls(
      categoriesToValidate: { categoriesToChange: Id64Array; isVisible: boolean; enableAllSubCategories: boolean }[],
      subCategories: { subCategoryId: Id64String; isVisible: boolean }[],
    ) {
      for (const category of categoriesToValidate) {
        expect(changeCategoryDisplayStub).to.be.calledWith(category.categoriesToChange, category.isVisible, category.enableAllSubCategories);
      }
      for (const subCategory of subCategories) {
        expect(changeSubCategoryDisplayStub).to.be.calledWith(subCategory.subCategoryId, subCategory.isVisible);
      }
    },
  } as unknown as Viewport & ViewportStubValidation;
}
