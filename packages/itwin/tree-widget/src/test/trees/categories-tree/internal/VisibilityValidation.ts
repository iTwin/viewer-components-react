/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { expect } from "chai";
import { CategoriesTreeNode } from "../../../../tree-widget-react/components/trees/categories-tree/CategoriesTreeNode.js";

import type { Id64Array } from "@itwin/core-bentley";
import type { HierarchyNode } from "@itwin/presentation-hierarchies";
import type { ValidateNodeProps } from "../../common/VisibilityValidation.js";

export async function validateNodeVisibility({ node, handler, expectations }: ValidateNodeProps & { node: HierarchyNode }) {
  const actualVisibility = await handler.getVisibilityStatus(node);

  if (expectations === "all-hidden" || expectations === "all-visible") {
    expect(actualVisibility.state).to.eq(expectations === "all-hidden" ? "hidden" : "visible", `Node, ${JSON.stringify(node)}`);
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
        expect(actualVisibility.isDisabled).to.eq(true, `Node, ${JSON.stringify(node)}`);
      }
      if (visibleCount > 0 && hiddenCount > 0) {
        expect(actualVisibility.state).to.eq("partial", `Node, ${JSON.stringify(node)}`);
        return;
      }
    }
    expect(actualVisibility.state).to.eq(visibleCount > 0 ? "visible" : "hidden", `Node, ${JSON.stringify(node)}`);
    return;
  }

  if (CategoriesTreeNode.isSubCategoryNode(node)) {
    const { id } = node.key.instanceKeys[0];
    // One subCategory gets added when category is inserted
    if (expectations[id] === "disabled") {
      expect(actualVisibility.isDisabled).to.eq(true, `Node, ${JSON.stringify(node)}`);
    } else {
      expect(actualVisibility.state).to.eq(expectations[id], `Node, ${JSON.stringify(node)}`);
    }
    return;
  }
  if (CategoriesTreeNode.isCategoryNode(node)) {
    const { id } = node.key.instanceKeys[0];
    const modelIds: Id64Array | undefined = node.extendedData.isCategoryOfSubModel ? node.extendedData.modelIds : undefined;
    let idToUse = id;
    if (modelIds !== undefined) {
      idToUse = `${modelIds[0]}-${id}`;
    }
    if (expectations[idToUse] === "disabled") {
      expect(actualVisibility.isDisabled).to.eq(true, `Node, ${JSON.stringify(node)}`);
    } else {
      expect(actualVisibility.state).to.eq(expectations[idToUse], `Node, ${JSON.stringify(node)}`);
    }
    return;
  }
  if (CategoriesTreeNode.isModelNode(node) || CategoriesTreeNode.isDefinitionContainerNode(node) || CategoriesTreeNode.isElementNode(node)) {
    const { id } = node.key.instanceKeys[0];
    if (expectations[id] === "disabled") {
      expect(actualVisibility.isDisabled).to.eq(true, `Node, ${JSON.stringify(node)}`);
    } else {
      expect(actualVisibility.state).to.eq(expectations[id], `Node, ${JSON.stringify(node)}`);
    }
    return;
  }
  throw new Error(`Expected hierarchy to contain only definitionContainers, categories, subcategories, models and elements got ${JSON.stringify(node)}`);
}
