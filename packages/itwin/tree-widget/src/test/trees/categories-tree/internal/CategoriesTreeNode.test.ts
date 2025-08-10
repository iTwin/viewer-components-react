/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { expect } from "chai";
import { CategoriesTreeNode } from "../../../../tree-widget-react/components/trees/categories-tree/internal/visibility/CategoriesTreeNode.js";

import type { ClassGroupingHierarchyNode } from "../../../../tree-widget-react/components/trees/models-tree/ModelsTreeDefinition.js";
import type { NonGroupingHierarchyNode } from "@itwin/presentation-hierarchies";

describe("CategoriesTreeNode", () => {
  const randomNode: NonGroupingHierarchyNode = {
    parentKeys: [],
    key: { instanceKeys: [], type: "instances" },
    label: "",
    children: false,
    extendedData: {},
  };
  const categoryNode: NonGroupingHierarchyNode = {
    parentKeys: [],
    key: { instanceKeys: [], type: "instances" },
    label: "",
    children: false,
    extendedData: {
      isCategory: 1,
    },
  };
  const elementNode: NonGroupingHierarchyNode = {
    parentKeys: [],
    key: { instanceKeys: [], type: "instances" },
    label: "",
    children: false,
    extendedData: {
      isElement: 1,
      modelId: "0x1",
      categoryId: "0x2",
    },
  };
  const subCategoryNode: NonGroupingHierarchyNode = {
    parentKeys: [],
    key: { instanceKeys: [], type: "instances" },
    label: "",
    children: false,
    extendedData: {
      isSubCategory: 1,
      categoryId: "0x1",
    },
  };
  const definitionContainerNode: NonGroupingHierarchyNode = {
    parentKeys: [],
    key: { instanceKeys: [], type: "instances" },
    label: "",
    children: false,
    extendedData: {
      isDefinitionContainer: 1,
    },
  };
  const elementGroupingNode: ClassGroupingHierarchyNode = {
    key: {
      className: "c",
      type: "class-grouping",
    },
    parentKeys: [],
    label: "c",
    groupedInstanceKeys: [],
    children: true,
    extendedData: {
      modelElementsMap: new Map(),
      categoryId: "0x2",
    },
  };

  it("isCategoryNode", () => {
    expect(CategoriesTreeNode.isCategoryNode(randomNode)).to.be.false;
    expect(CategoriesTreeNode.isCategoryNode(categoryNode)).to.be.true;
    expect(CategoriesTreeNode.isCategoryNode(subCategoryNode)).to.be.false;
    expect(CategoriesTreeNode.isCategoryNode(definitionContainerNode)).to.be.false;
    expect(CategoriesTreeNode.isCategoryNode(elementNode)).to.be.false;
    expect(CategoriesTreeNode.isCategoryNode(elementGroupingNode)).to.be.false;
  });

  it("isSubCategoryNode", () => {
    expect(CategoriesTreeNode.isSubCategoryNode(randomNode)).to.be.false;
    expect(CategoriesTreeNode.isSubCategoryNode(categoryNode)).to.be.false;
    expect(CategoriesTreeNode.isSubCategoryNode(subCategoryNode)).to.be.true;
    expect(CategoriesTreeNode.isSubCategoryNode(definitionContainerNode)).to.be.false;
    expect(CategoriesTreeNode.isSubCategoryNode(elementNode)).to.be.false;
    expect(CategoriesTreeNode.isSubCategoryNode(elementGroupingNode)).to.be.false;
  });

  it("isDefinitionContainerNode", () => {
    expect(CategoriesTreeNode.isDefinitionContainerNode(randomNode)).to.be.false;
    expect(CategoriesTreeNode.isDefinitionContainerNode(categoryNode)).to.be.false;
    expect(CategoriesTreeNode.isDefinitionContainerNode(subCategoryNode)).to.be.false;
    expect(CategoriesTreeNode.isDefinitionContainerNode(definitionContainerNode)).to.be.true;
    expect(CategoriesTreeNode.isDefinitionContainerNode(elementNode)).to.be.false;
    expect(CategoriesTreeNode.isDefinitionContainerNode(elementGroupingNode)).to.be.false;
  });

  it("isElementNode", () => {
    expect(CategoriesTreeNode.isElementNode(randomNode)).to.be.false;
    expect(CategoriesTreeNode.isElementNode(categoryNode)).to.be.false;
    expect(CategoriesTreeNode.isElementNode(subCategoryNode)).to.be.false;
    expect(CategoriesTreeNode.isElementNode(definitionContainerNode)).to.be.false;
    expect(CategoriesTreeNode.isElementNode(elementNode)).to.be.true;
    expect(CategoriesTreeNode.isElementNode(elementGroupingNode)).to.be.false;
  });

  it("isElementClassGroupingNode", () => {
    expect(CategoriesTreeNode.isElementClassGroupingNode(randomNode)).to.be.false;
    expect(CategoriesTreeNode.isElementClassGroupingNode(categoryNode)).to.be.false;
    expect(CategoriesTreeNode.isElementClassGroupingNode(subCategoryNode)).to.be.false;
    expect(CategoriesTreeNode.isElementClassGroupingNode(definitionContainerNode)).to.be.false;
    expect(CategoriesTreeNode.isElementClassGroupingNode(elementNode)).to.be.false;
    expect(CategoriesTreeNode.isElementClassGroupingNode(elementGroupingNode)).to.be.true;
  });
});
