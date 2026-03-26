/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { ClassificationsTreeNode } from "../../../tree-widget-react/components/trees/classifications-tree/ClassificationsTreeNode.js";

import type { HierarchyNode } from "@itwin/presentation-hierarchies";
import type { ValidateNodeProps } from "../common/VisibilityValidation.js";

export async function validateNodeVisibility({ node, handler, expectations }: ValidateNodeProps & { node: HierarchyNode }) {
  const actualVisibility = await handler.getVisibilityStatus(node);

  if (expectations === "all-hidden" || expectations === "all-visible") {
    expect(actualVisibility.state, `Node, ${JSON.stringify(node)}`).toBe(expectations === "all-hidden" ? "hidden" : "visible");
    return;
  }

  if (
    ClassificationsTreeNode.isClassificationNode(node) ||
    ClassificationsTreeNode.isClassificationTableNode(node) ||
    ClassificationsTreeNode.isGeometricElementNode(node)
  ) {
    const { id } = node.key.instanceKeys[0];
    if (expectations[id] === "disabled") {
      expect(actualVisibility.isDisabled, `Node, ${JSON.stringify(node)}`).toBe(true);
    } else {
      expect(actualVisibility.state, `Node, ${JSON.stringify(node)}`).toBe(expectations[id]);
    }
    return;
  }
  throw new Error(`Expected hierarchy to contain only classification tables, classifications and elements got ${JSON.stringify(node)}`);
}
