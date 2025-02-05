/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { expect } from "chai";
import sinon from "sinon";
import { BeEvent } from "@itwin/core-bentley";
import { PerModelCategoryVisibility } from "@itwin/core-frontend";

import type { Id64Array, Id64String } from "@itwin/core-bentley";
import type { Viewport } from "@itwin/core-frontend";
import type { NonGroupingHierarchyNode } from "@itwin/presentation-hierarchies";
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
export async function createViewportStub(idsCache: CategoriesTreeIdsCache, isVisibleOnInitialize = false): Promise<Viewport & ViewportStubValidation> {
  const subCategoriesMap = new Map<Id64String, boolean>();

  const categoriesMap = new Map<
    Id64String,
    {
      subCategories: Id64Array;
      isVisible: boolean;
    }
  >();

  const { categories: categoriesFromCache } = await idsCache.getAllDefinitionContainersAndCategories();
  for (const category of categoriesFromCache) {
    const subCategoriesFromCache = await idsCache.getSubCategories(category);
    subCategoriesFromCache.forEach((subCategoryId) => {
      subCategoriesMap.set(subCategoryId, isVisibleOnInitialize);
    });
    categoriesMap.set(category, { isVisible: isVisibleOnInitialize, subCategories: subCategoriesFromCache });
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
      }
    }
  });

  const changeSubCategoryDisplayStub = sinon.stub().callsFake((subCategoryId: Id64String, isVisible: boolean) => {
    subCategoriesMap.set(subCategoryId, isVisible);
  });

  return {
    isSubCategoryVisible: sinon.stub().callsFake((subCategoryId: Id64String) => !!subCategoriesMap.get(subCategoryId)),
    iModel: {
      categories: {
        getCategoryInfo: sinon.stub().callsFake(async (ids: Id64Array) => {
          const subCategories = [];
          for (const id of ids) {
            const subCategoriesToUse = categoriesMap.get(id);
            if (subCategoriesToUse !== undefined) {
              subCategories.push(...subCategoriesToUse.subCategories);
            }
          }
          return [
            {
              subCategories: subCategories.map((subCategory) => {
                return {
                  id: subCategory,
                };
              }),
            },
          ];
        }),
      },
    },
    view: {
      viewsCategory: sinon.stub().callsFake((categoryId: Id64String) => !!categoriesMap.get(categoryId)?.isVisible),
    },
    changeSubCategoryDisplay: changeSubCategoryDisplayStub,
    changeCategoryDisplay: changeCategoryDisplayStub,
    perModelCategoryVisibility: {
      getOverride: sinon.fake.returns(PerModelCategoryVisibility.Override.None),
      setOverride: sinon.fake(),
      clearOverrides: sinon.fake(),
      *[Symbol.iterator]() {},
    },
    onDisplayStyleChanged: new BeEvent<() => void>(),
    onViewedCategoriesChanged: new BeEvent<() => void>(),
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
