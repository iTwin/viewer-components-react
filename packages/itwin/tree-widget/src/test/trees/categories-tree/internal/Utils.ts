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

/**
 * Class that has necessary utilities for testing CategoriesTree visibility.
 * It allows stubbing `Viewport` and validating if specific functions get called with appropriate params.
 * @internal
 */
export class ViewportMock {
  private _idsCache: CategoriesTreeIdsCache;
  private _subCategories: Map<Id64String, boolean>;

  private _categories: Map<
    Id64String,
    {
      subCategories: Id64Array;
      isVisible: boolean;
    }
  >;

  constructor(idsCache: CategoriesTreeIdsCache) {
    this._idsCache = idsCache;
    this._categories = new Map();
    this._subCategories = new Map();
  }

  /**
   * Creates a stubbed `Viewport` with that has only necessary properties defined for determening CategoriesTree visibility.
   *
   * This stub allows changing and saving the display of categories and subcategories
   * @returns stubbed `Viewport`
   */
  public async createViewportStub(): Promise<Viewport> {
    const { categories } = await this._idsCache.getAllDefinitionContainersAndCategories();
    for (const category of categories) {
      const subCategories = await this._idsCache.getSubCategories(category);
      subCategories.forEach((subCategoryId) => {
        this._subCategories.set(subCategoryId, false);
      });
      this._categories.set(category, { isVisible: false, subCategories });
    }

    return {
      isSubCategoryVisible: sinon.stub().callsFake((subCategoryId: Id64String) => !!this._subCategories.get(subCategoryId)),
      iModel: {
        categories: {
          getCategoryInfo: sinon.stub().callsFake(async (ids: Id64Array) => {
            const subCategories = [];
            for (const id of ids) {
              const subCategoriesToUse = this._categories.get(id);
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
        viewsCategory: sinon.stub().callsFake((categoryId: Id64String) => !!this._categories.get(categoryId)?.isVisible),
      },
      changeSubCategoryDisplay: sinon.stub().callsFake((subCategoryId: Id64String, isVisible: boolean) => {
        this._subCategories.set(subCategoryId, isVisible);
      }),
      changeCategoryDisplay: sinon.stub().callsFake((categoriesToChange: Id64Array, isVisible: boolean, enableAllSubCategories: boolean) => {
        for (const category of categoriesToChange) {
          const value = this._categories.get(category);
          if (value) {
            value.isVisible = isVisible;
            if (enableAllSubCategories) {
              for (const subCategory of value.subCategories) {
                this._subCategories.set(subCategory, true);
              }
            }
          }
        }
      }),
      perModelCategoryVisibility: {
        getOverride: sinon.fake.returns(PerModelCategoryVisibility.Override.None),
        setOverride: sinon.fake(),
        clearOverrides: sinon.fake(),
        *[Symbol.iterator]() {},
      },
      onDisplayStyleChanged: new BeEvent<() => void>(),
      onViewedCategoriesChanged: new BeEvent<() => void>(),
    } as unknown as Viewport;
  }

  /**
   * Checks if `view.viewsCategory` and `isSubCategoryVisible` get called with appropriate params
   *
   * @param stubbedViewport viewport created using `ViewportMock.createViewPortStub()`
   * @param categories categories that `stubbedViewport.view.viewsCategory` should be called with
   * @param subCategories subcategories that `stubbedViewport.isSubCategoryVisible` should be called with
   */
  public static validateViewsCalls(stubbedViewport: Viewport, categories: Id64Array, subCategories: Id64Array) {
    for (const category of categories) {
      expect(stubbedViewport.view.viewsCategory).to.be.calledWith(category);
    }
    for (const subCategory of subCategories) {
      expect(stubbedViewport.isSubCategoryVisible).to.be.calledWith(subCategory);
    }
  }

  /**
   * Checks if `changeCategoryDisplay` and `changeSubCategoryDisplay` get called with appropriate params
   *
   * @param stubbedViewport viewport created using `ViewportMock.createViewPortStub()`
   * @param categories categories parameters that `stubbedViewport.changeCategoryDisplay` should be called with
   * @param subCategories subcategories parameters that `stubbedViewport.changeSubCategoryDisplay` should be called with
   */
  public static validateChangesCalls(
    stubbedViewport: Viewport,
    categories: { categoriesToChange: Id64Array; isVisible: boolean; enableAllSubCategories: boolean }[],
    subCategories: { subCategoryId: Id64String; isVisible: boolean }[],
  ) {
    for (const category of categories) {
      expect(stubbedViewport.changeCategoryDisplay).to.be.calledWith(category.categoriesToChange, category.isVisible, category.enableAllSubCategories);
    }
    for (const subCategory of subCategories) {
      expect(stubbedViewport.changeSubCategoryDisplay).to.be.calledWith(subCategory.subCategoryId, subCategory.isVisible);
    }
  }
}
