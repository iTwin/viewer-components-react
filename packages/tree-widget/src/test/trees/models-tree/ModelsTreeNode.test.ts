/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { describe, expect, it } from "vitest";
import { CLASS_NAME_GeometricElement3d } from "../../../tree-widget-react/shared/internal/ClassNameDefinitions.js";
import { ModelsTreeNode } from "../../../tree-widget-react/trees/models-tree/ModelsTreeNode.js";

import type { HierarchyNode } from "@itwin/presentation-hierarchies";

describe("ModelsTreeNode", () => {
  const createNode = (type?: string): HierarchyNode => ({
    key: { type: "instances", instanceKeys: [] },
    parentKeys: [],
    label: "",
    children: false,
    extendedData: type ? { type } : {},
  });

  const unknownNode = createNode();
  const subjectNode = createNode("subject");
  const modelNode = createNode("model");
  const categoryNode = createNode("category");
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

  it("isSubjectNode", () => {
    expect(ModelsTreeNode.isSubjectNode(unknownNode)).toBe(false);
    expect(ModelsTreeNode.isSubjectNode(subjectNode)).toBe(true);
    expect(ModelsTreeNode.isSubjectNode(modelNode)).toBe(false);
    expect(ModelsTreeNode.isSubjectNode(categoryNode)).toBe(false);
    expect(ModelsTreeNode.isSubjectNode(elementNode)).toBe(false);
    expect(ModelsTreeNode.isSubjectNode(classGroupingNode)).toBe(false);
  });

  it("isModelNode", () => {
    expect(ModelsTreeNode.isModelNode(unknownNode)).toBe(false);
    expect(ModelsTreeNode.isModelNode(subjectNode)).toBe(false);
    expect(ModelsTreeNode.isModelNode(modelNode)).toBe(true);
    expect(ModelsTreeNode.isModelNode(categoryNode)).toBe(false);
    expect(ModelsTreeNode.isModelNode(elementNode)).toBe(false);
    expect(ModelsTreeNode.isModelNode(classGroupingNode)).toBe(false);
  });

  it("isCategoryNode", () => {
    expect(ModelsTreeNode.isCategoryNode(unknownNode)).toBe(false);
    expect(ModelsTreeNode.isCategoryNode(subjectNode)).toBe(false);
    expect(ModelsTreeNode.isCategoryNode(modelNode)).toBe(false);
    expect(ModelsTreeNode.isCategoryNode(categoryNode)).toBe(true);
    expect(ModelsTreeNode.isCategoryNode(elementNode)).toBe(false);
    expect(ModelsTreeNode.isCategoryNode(classGroupingNode)).toBe(false);
  });

  it("isElementNode", () => {
    expect(ModelsTreeNode.isElementNode(unknownNode)).toBe(false);
    expect(ModelsTreeNode.isElementNode(subjectNode)).toBe(false);
    expect(ModelsTreeNode.isElementNode(modelNode)).toBe(false);
    expect(ModelsTreeNode.isElementNode(categoryNode)).toBe(false);
    expect(ModelsTreeNode.isElementNode(elementNode)).toBe(true);
    expect(ModelsTreeNode.isElementNode(classGroupingNode)).toBe(false);
  });

  it("isElementClassGroupingNode", () => {
    expect(ModelsTreeNode.isElementClassGroupingNode(unknownNode)).toBe(false);
    expect(ModelsTreeNode.isElementClassGroupingNode(subjectNode)).toBe(false);
    expect(ModelsTreeNode.isElementClassGroupingNode(classGroupingNode)).toBe(true);
  });

  it("getType returns the matching type", () => {
    expect(ModelsTreeNode.getType(subjectNode)).toBe("subject");
    expect(ModelsTreeNode.getType(modelNode)).toBe("model");
    expect(ModelsTreeNode.getType(categoryNode)).toBe("category");
    expect(ModelsTreeNode.getType(elementNode)).toBe("element");
    expect(ModelsTreeNode.getType(classGroupingNode)).toBe("elements-class-group");
    expect(ModelsTreeNode.getType(unknownNode)).toBeUndefined();
  });
});
