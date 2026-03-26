/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { CategoriesTreeNode } from "../../../../tree-widget-react/components/trees/categories-tree/CategoriesTreeNode.js";

describe("CategoriesTreeNode", () => {
  const randomNode = {
    extendedData: {},
  };
  const categoryNode = {
    extendedData: {
      isCategory: 1,
    },
  };
  const subCategoryNode = {
    extendedData: {
      isSubCategory: 1,
    },
  };
  const definitionContainerNode = {
    extendedData: {
      isDefinitionContainer: 1,
    },
  };

  it("isCategoryNode", () => {
    expect(CategoriesTreeNode.isCategoryNode(randomNode)).toBe(false);
    expect(CategoriesTreeNode.isCategoryNode(categoryNode)).toBe(true);
    expect(CategoriesTreeNode.isCategoryNode(subCategoryNode)).toBe(false);
    expect(CategoriesTreeNode.isCategoryNode(definitionContainerNode)).toBe(false);
  });

  it("isSubCategoryNode", () => {
    expect(CategoriesTreeNode.isSubCategoryNode(randomNode)).toBe(false);
    expect(CategoriesTreeNode.isSubCategoryNode(categoryNode)).toBe(false);
    expect(CategoriesTreeNode.isSubCategoryNode(subCategoryNode)).toBe(true);
    expect(CategoriesTreeNode.isSubCategoryNode(definitionContainerNode)).toBe(false);
  });

  it("isDefinitionContainerNode", () => {
    expect(CategoriesTreeNode.isDefinitionContainerNode(randomNode)).toBe(false);
    expect(CategoriesTreeNode.isDefinitionContainerNode(categoryNode)).toBe(false);
    expect(CategoriesTreeNode.isDefinitionContainerNode(subCategoryNode)).toBe(false);
    expect(CategoriesTreeNode.isDefinitionContainerNode(definitionContainerNode)).toBe(true);
  });
});
