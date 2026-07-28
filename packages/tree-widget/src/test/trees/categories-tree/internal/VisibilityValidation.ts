/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { expect } from "vitest";
import { CategoriesTreeNode } from "../../../../tree-widget-react/components/trees/categories-tree/CategoriesTreeNode.js";
import { CategoriesTreeNodeInternal } from "../../../../tree-widget-react/components/trees/categories-tree/internal/CategoriesTreeNodeInternal.js";

import type { HierarchyNode } from "@itwin/presentation-hierarchies";
import type { ValidateNodeProps } from "../../common/VisibilityValidation.js";

export async function validateNodeVisibility({ node, handler, expectations }: ValidateNodeProps & { node: HierarchyNode }) {
  const actualVisibility = await handler.getVisibilityStatus(node);

  if (expectations === "all-hidden" || expectations === "all-visible") {
    expect(actualVisibility.state, `Node, ${JSON.stringify(node)}`).toBe(expectations === "all-hidden" ? "hidden" : "visible");
    return;
  }

  if (CategoriesTreeNode.isElementClassGroupingNode(node)) {
    const elementIds = node.groupedInstanceKeys.map(({ id: elementId }) => elementId);
    let visibleCount = 0;
    let hiddenCount = 0;

    for (const elementId of elementIds) {
      if (expectations[elementId] === "visible") {
        ++visibleCount;
      } else if (expectations[elementId] === "hidden") {
        ++hiddenCount;
      } else if (expectations[elementId] === "partial") {
        ++hiddenCount;
        ++visibleCount;
      } else if (expectations[elementId] === "disabled") {
        expect(actualVisibility.isDisabled, `Node, ${JSON.stringify(node)}`).toBe(true);
        return;
      }
      if (visibleCount > 0 && hiddenCount > 0) {
        expect(actualVisibility.state, `Node, ${JSON.stringify(node)}`).toBe("partial");
        return;
      }
    }
    expect(actualVisibility.state, `Node, ${JSON.stringify(node)}`).toBe(visibleCount > 0 ? "visible" : "hidden");
    return;
  }

  if (CategoriesTreeNode.isSubCategoryNode(node)) {
    const { id } = node.key.instanceKeys[0];
    // One subCategory gets added when category is inserted
    if (expectations[id] === "disabled") {
      expect(actualVisibility.isDisabled, `Node, ${JSON.stringify(node)}`).toBe(true);
    } else {
      expect(actualVisibility.state, `Node, ${JSON.stringify(node)}`).toBe(expectations[id]);
    }
    return;
  }
  if (CategoriesTreeNodeInternal.isCategoryNode(node)) {
    const { id } = node.key.instanceKeys[0];
    let idToUse = id;
    const parentOrModelId =
      node.extendedData.parentElementsPath.length > 0
        ? node.extendedData.parentElementsPath[node.extendedData.parentElementsPath.length - 1].elementIds[0]
        : node.extendedData.modelIds.length > 0
          ? node.extendedData.modelIds[0]
          : undefined;
    if (parentOrModelId !== undefined) {
      idToUse = `${parentOrModelId}-${id}`;
    }
    if (expectations[idToUse] === "disabled") {
      expect(actualVisibility.isDisabled, `Node, ${JSON.stringify(node)}`).toBe(true);
    } else {
      expect(actualVisibility.state, `Node, ${JSON.stringify(node)}`).toBe(expectations[idToUse]);
    }
    return;
  }
  if (CategoriesTreeNode.isModelNode(node) || CategoriesTreeNode.isDefinitionContainerNode(node) || CategoriesTreeNode.isElementNode(node)) {
    const { id } = node.key.instanceKeys[0];
    if (expectations[id] === "disabled") {
      expect(actualVisibility.isDisabled, `Node, ${JSON.stringify(node)}`).toBe(true);
    } else {
      expect(actualVisibility.state, `Node, ${JSON.stringify(node)}`).toBe(expectations[id]);
    }
    return;
  }
  throw new Error(`Expected hierarchy to contain only definitionContainers, categories, subcategories, models and elements got ${JSON.stringify(node)}`);
}
