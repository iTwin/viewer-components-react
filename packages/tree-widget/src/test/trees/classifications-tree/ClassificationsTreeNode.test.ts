/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { describe, expect, it } from "vitest";
import { ClassificationsTreeNode } from "../../../tree-widget-react/trees/classifications-tree/ClassificationsTreeNode.js";

import type { HierarchyNode } from "@itwin/presentation-hierarchies";

describe("ClassificationsTreeNode", () => {
  const createNode = (type?: string): HierarchyNode => ({
    key: { type: "instances", instanceKeys: [] },
    parentKeys: [],
    label: "",
    children: false,
    extendedData: type ? { type } : {},
  });

  const unknownNode = createNode();
  const classificationTableNode = createNode("classification-table");
  const classificationNode = createNode("classification");
  const elementNode = createNode("element");

  it("isClassificationTableNode", () => {
    expect(ClassificationsTreeNode.isClassificationTableNode(unknownNode)).toBe(false);
    expect(ClassificationsTreeNode.isClassificationTableNode(classificationTableNode)).toBe(true);
    expect(ClassificationsTreeNode.isClassificationTableNode(classificationNode)).toBe(false);
    expect(ClassificationsTreeNode.isClassificationTableNode(elementNode)).toBe(false);
  });

  it("isClassificationNode", () => {
    expect(ClassificationsTreeNode.isClassificationNode(unknownNode)).toBe(false);
    expect(ClassificationsTreeNode.isClassificationNode(classificationTableNode)).toBe(false);
    expect(ClassificationsTreeNode.isClassificationNode(classificationNode)).toBe(true);
    expect(ClassificationsTreeNode.isClassificationNode(elementNode)).toBe(false);
  });

  it("isGeometricElementNode", () => {
    expect(ClassificationsTreeNode.isGeometricElementNode(unknownNode)).toBe(false);
    expect(ClassificationsTreeNode.isGeometricElementNode(classificationTableNode)).toBe(false);
    expect(ClassificationsTreeNode.isGeometricElementNode(classificationNode)).toBe(false);
    expect(ClassificationsTreeNode.isGeometricElementNode(elementNode)).toBe(true);
  });

  it("getType returns the matching type", () => {
    expect(ClassificationsTreeNode.getType(classificationTableNode)).toBe("classification-table");
    expect(ClassificationsTreeNode.getType(classificationNode)).toBe("classification");
    expect(ClassificationsTreeNode.getType(elementNode)).toBe("element");
    expect(ClassificationsTreeNode.getType(unknownNode)).toBeUndefined();
  });
});
