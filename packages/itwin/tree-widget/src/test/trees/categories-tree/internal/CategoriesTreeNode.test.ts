/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { expect } from "chai";
import { CategoriesTreeNode } from "../../../../tree-widget-react/components/trees/categories-tree/internal/CategoriesTreeNode.js";

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
    expect(CategoriesTreeNode.isCategoryNode(randomNode)).to.be.false;
    expect(CategoriesTreeNode.isCategoryNode(categoryNode)).to.be.true;
    expect(CategoriesTreeNode.isCategoryNode(subCategoryNode)).to.be.false;
    expect(CategoriesTreeNode.isCategoryNode(definitionContainerNode)).to.be.false;
  });

  it("isSubCategoryNode", () => {
    expect(CategoriesTreeNode.isSubCategoryNode(randomNode)).to.be.false;
    expect(CategoriesTreeNode.isSubCategoryNode(categoryNode)).to.be.false;
    expect(CategoriesTreeNode.isSubCategoryNode(subCategoryNode)).to.be.true;
    expect(CategoriesTreeNode.isSubCategoryNode(definitionContainerNode)).to.be.false;
  });

  it("isDefinitionContainerNode", () => {
    expect(CategoriesTreeNode.isDefinitionContainerNode(randomNode)).to.be.false;
    expect(CategoriesTreeNode.isDefinitionContainerNode(categoryNode)).to.be.false;
    expect(CategoriesTreeNode.isDefinitionContainerNode(subCategoryNode)).to.be.false;
    expect(CategoriesTreeNode.isDefinitionContainerNode(definitionContainerNode)).to.be.true;
  });
});
