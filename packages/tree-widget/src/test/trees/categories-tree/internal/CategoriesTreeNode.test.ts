/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { describe, expect, it } from "vitest";
import { CategoriesTreeNode } from "../../../../tree-widget-react/components/trees/categories-tree/CategoriesTreeNode.js";
import { CLASS_NAME_GeometricElement3d } from "../../../../tree-widget-react/components/trees/common/internal/ClassNameDefinitions.js";

import type { HierarchyNode } from "@itwin/presentation-hierarchies";

describe("CategoriesTreeNode", () => {
  const createNode = (type?: string): HierarchyNode => ({
    key: { type: "instances", instanceKeys: [] },
    parentKeys: [],
    label: "",
    children: false,
    extendedData: type ? { type } : {},
  });

  const unknownNode = createNode();
  const categoryNode = createNode("category");
  const subCategoryNode = createNode("sub-category");
  const definitionContainerNode = createNode("definition-container");
  const modelNode = createNode("model");
  const elementNode = createNode("element");
  const classGroupingNode: HierarchyNode = {
    key: {
      type: "class-grouping",
      className: CLASS_NAME_GeometricElement3d,
    },
    parentKeys: [],
    label: "",
    children: false,
    groupedInstanceKeys: [],
    extendedData: {},
  };

  it("isCategoryNode", () => {
    expect(CategoriesTreeNode.isCategoryNode(unknownNode)).toBe(false);
    expect(CategoriesTreeNode.isCategoryNode(categoryNode)).toBe(true);
    expect(CategoriesTreeNode.isCategoryNode(subCategoryNode)).toBe(false);
    expect(CategoriesTreeNode.isCategoryNode(definitionContainerNode)).toBe(false);
    expect(CategoriesTreeNode.isCategoryNode(classGroupingNode)).toBe(false);
  });

  it("isSubCategoryNode", () => {
    expect(CategoriesTreeNode.isSubCategoryNode(unknownNode)).toBe(false);
    expect(CategoriesTreeNode.isSubCategoryNode(categoryNode)).toBe(false);
    expect(CategoriesTreeNode.isSubCategoryNode(subCategoryNode)).toBe(true);
    expect(CategoriesTreeNode.isSubCategoryNode(definitionContainerNode)).toBe(false);
    expect(CategoriesTreeNode.isSubCategoryNode(classGroupingNode)).toBe(false);
  });

  it("isDefinitionContainerNode", () => {
    expect(CategoriesTreeNode.isDefinitionContainerNode(unknownNode)).toBe(false);
    expect(CategoriesTreeNode.isDefinitionContainerNode(categoryNode)).toBe(false);
    expect(CategoriesTreeNode.isDefinitionContainerNode(subCategoryNode)).toBe(false);
    expect(CategoriesTreeNode.isDefinitionContainerNode(definitionContainerNode)).toBe(true);
    expect(CategoriesTreeNode.isDefinitionContainerNode(classGroupingNode)).toBe(false);
  });

  it("isModelNode", () => {
    expect(CategoriesTreeNode.isModelNode(unknownNode)).toBe(false);
    expect(CategoriesTreeNode.isModelNode(categoryNode)).toBe(false);
    expect(CategoriesTreeNode.isModelNode(modelNode)).toBe(true);
    expect(CategoriesTreeNode.isModelNode(elementNode)).toBe(false);
    expect(CategoriesTreeNode.isModelNode(classGroupingNode)).toBe(false);
  });

  it("isElementNode", () => {
    expect(CategoriesTreeNode.isElementNode(unknownNode)).toBe(false);
    expect(CategoriesTreeNode.isElementNode(categoryNode)).toBe(false);
    expect(CategoriesTreeNode.isElementNode(modelNode)).toBe(false);
    expect(CategoriesTreeNode.isElementNode(elementNode)).toBe(true);
    expect(CategoriesTreeNode.isElementNode(classGroupingNode)).toBe(false);
  });

  it("isElementClassGroupingNode", () => {
    expect(CategoriesTreeNode.isElementClassGroupingNode(unknownNode)).toBe(false);
    expect(CategoriesTreeNode.isElementClassGroupingNode(categoryNode)).toBe(false);
    expect(CategoriesTreeNode.isElementClassGroupingNode(classGroupingNode)).toBe(true);
  });

  it("getType returns the matching type", () => {
    expect(CategoriesTreeNode.getType(categoryNode)).toBe("category");
    expect(CategoriesTreeNode.getType(subCategoryNode)).toBe("sub-category");
    expect(CategoriesTreeNode.getType(definitionContainerNode)).toBe("definition-container");
    expect(CategoriesTreeNode.getType(modelNode)).toBe("model");
    expect(CategoriesTreeNode.getType(elementNode)).toBe("element");
    expect(CategoriesTreeNode.getType(classGroupingNode)).toBe("elements-class-group");
    expect(CategoriesTreeNode.getType(unknownNode)).toBeUndefined();
  });
});
