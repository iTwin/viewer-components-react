/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { expect } from "chai";
import { ModelsTreeNode } from "../../../../tree-widget-react/components/trees/models-tree/ModelsTreeNode.js";

import type { HierarchyNode } from "@itwin/presentation-hierarchies";
import type { ValidateNodeProps } from "../../common/VisibilityValidation.js";

export async function validateNodeVisibility({ node, handler, expectations }: ValidateNodeProps & { node: HierarchyNode }) {
  const actualVisibility = await handler.getVisibilityStatus(node);

  if (expectations === "all-hidden" || expectations === "all-visible") {
    expect(actualVisibility.state).to.eq(expectations === "all-hidden" ? "hidden" : "visible", `Node, ${node.label}`);
    return;
  }

  if (ModelsTreeNode.isElementClassGroupingNode(node)) {
    const elementIds = node.groupedInstanceKeys.map(({ id: elementId }) => elementId);
    let visibleCount = 0;
    let hiddenCount = 0;

    for (const elementId of elementIds) {
      if (expectations[elementId] === "visible") {
        ++visibleCount;
      } else if (expectations[elementId] === "hidden") {
        ++hiddenCount;
      } else {
        ++hiddenCount;
        ++visibleCount;
      }
      if (visibleCount > 0 && hiddenCount > 0) {
        expect(actualVisibility.state).to.eq("partial", `Node, ${JSON.stringify(node)}`);
        return;
      }
    }
    expect(actualVisibility.state).to.eq(visibleCount > 0 ? "visible" : "hidden", `Node, ${JSON.stringify(node)}`);
    return;
  }

  if (ModelsTreeNode.isSubjectNode(node) || ModelsTreeNode.isElementNode(node) || ModelsTreeNode.isModelNode(node)) {
    const { id } = node.key.instanceKeys[0];
    expect(actualVisibility.state).to.eq(expectations[id], `Node, ${JSON.stringify(node)}`);
    return;
  }

  if (ModelsTreeNode.isCategoryNode(node)) {
    const { id } = node.key.instanceKeys[0];
    const modelId = node.extendedData.modelIds[0];
    const idToUse = `${modelId}-${id}`;
    expect(actualVisibility.state).to.eq(expectations[idToUse], `Node, ${node.label}`);
    return;
  }
  throw new Error(`Expected hierarchy to contain only subjects, models, categories and elements got ${JSON.stringify(node)}`);
}
