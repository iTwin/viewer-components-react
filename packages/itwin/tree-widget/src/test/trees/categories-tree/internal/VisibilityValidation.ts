/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { expect } from "chai";
import { EMPTY, expand, from, mergeMap } from "rxjs";
import { HierarchyNode } from "@itwin/presentation-hierarchies";
import { CategoriesTreeNode } from "../../../../tree-widget-react/components/trees/categories-tree/internal/CategoriesTreeNode.js";
import { toVoidPromise } from "../../../../tree-widget-react/components/trees/common/Rxjs.js";

import type { Viewport } from "@itwin/core-frontend";
import type { HierarchyProvider } from "@itwin/presentation-hierarchies";
import type { Visibility } from "../../../../tree-widget-react/components/trees/common/Tooltip.js";
import type { HierarchyVisibilityHandler } from "../../../../tree-widget-react/components/trees/common/UseHierarchyVisibility.js";

interface VisibilityExpectations {
  [id: string]: Visibility;
}

export interface ValidateNodeProps {
  handler: HierarchyVisibilityHandler;
  viewport: Viewport;
  expectations: "all-visible" | "all-hidden" | VisibilityExpectations;
}

export async function validateNodeVisibility({ node, handler, expectations }: ValidateNodeProps & { node: HierarchyNode }) {
  const actualVisibility = await handler.getVisibilityStatus(node);
  if (!HierarchyNode.isInstancesNode(node)) {
    throw new Error(`Expected hierarchy to only have instance nodes, got ${JSON.stringify(node)}`);
  }

  if (expectations === "all-hidden" || expectations === "all-visible") {
    expect(actualVisibility.state).to.eq(expectations === "all-hidden" ? "hidden" : "visible");
    return;
  }

  const { id } = node.key.instanceKeys[0];

  if (CategoriesTreeNode.isCategoryNode(node)) {
    expect(actualVisibility.state).to.eq(expectations[id]);
    return;
  }
  if (CategoriesTreeNode.isSubCategoryNode(node)) {
    // One subCategory gets added when category is inserted
    if (expectations[id] !== undefined) {
      expect(actualVisibility.state).to.eq(expectations[id]);
    }
    return;
  }
  if (CategoriesTreeNode.isDefinitionContainerNode(node)) {
    expect(actualVisibility.state).to.eq(expectations[id]);
    return;
  }

  throw new Error(`Expected hierarchy to contain only definitionContainers, categories and subcategories, got ${JSON.stringify(node)}`);
}

export async function validateHierarchyVisibility({
  provider,
  ...props
}: ValidateNodeProps & {
  provider: HierarchyProvider;
}) {
  await toVoidPromise(
    from(provider.getNodes({ parentNode: undefined })).pipe(
      expand((node) => (node.children ? provider.getNodes({ parentNode: node }) : EMPTY)),
      mergeMap(async (node) => validateNodeVisibility({ ...props, node })),
    ),
  );
}
