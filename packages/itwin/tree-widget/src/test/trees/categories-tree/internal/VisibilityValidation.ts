/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { expect } from "chai";
import { EMPTY, expand, from, mergeMap, tap } from "rxjs";
import { HierarchyNode } from "@itwin/presentation-hierarchies";
import { CategoriesTreeNode } from "../../../../tree-widget-react/components/trees/categories-tree/internal/CategoriesTreeNode.js";
import { toVoidPromise } from "../../../../tree-widget-react/components/trees/common/Rxjs.js";

import type { Id64Array, Id64String } from "@itwin/core-bentley";
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
  visibilityExpectations: VisibilityExpectations;
  expectedIds: Id64Array;
  all?: "visible" | "hidden";
}

export async function validateNodeVisibility({ node, handler, visibilityExpectations, all }: ValidateNodeProps & { node: HierarchyNode }) {
  const actualVisibility = await handler.getVisibilityStatus(node);
  if (!HierarchyNode.isInstancesNode(node)) {
    throw new Error(`Expected hierarchy to only have instance nodes, got ${JSON.stringify(node)}`);
  }

  if (all !== undefined) {
    expect(actualVisibility.state).to.eq(all);
    return;
  }

  const { id } = node.key.instanceKeys[0];

  if (CategoriesTreeNode.isCategoryNode(node)) {
    expect(actualVisibility.state).to.eq(visibilityExpectations[id]);
    return;
  }
  if (CategoriesTreeNode.isSubCategoryNode(node)) {
    // One subCategory gets added when category is inserted
    if (visibilityExpectations[id] !== undefined) {
      expect(actualVisibility.state).to.eq(visibilityExpectations[id]);
    }
    return;
  }
  if (CategoriesTreeNode.isDefinitionContainerNode(node)) {
    expect(actualVisibility.state).to.eq(visibilityExpectations[id]);
    return;
  }

  throw new Error(`Expected hierarchy to contain only definitionContainers, categories and subcategories, got ${JSON.stringify(node)}`);
}

export async function validateHierarchyVisibility({
  provider,
  ...props
}: Omit<ValidateNodeProps, "visibilityExpectations"> & {
  visibilityExpectations: VisibilityExpectations;
  provider: HierarchyProvider;
}) {
  const nodesFound = new Array<Id64String>();
  await toVoidPromise(
    from(provider.getNodes({ parentNode: undefined })).pipe(
      expand((node) => (node.children ? provider.getNodes({ parentNode: node }) : EMPTY)),
      tap((node) => {
        if (!HierarchyNode.isInstancesNode(node)) {
          throw new Error(`Expected hierarchy to contain only instance nodes, got ${JSON.stringify(node)}`);
        }
        nodesFound.push(node.key.instanceKeys[0].id);
      }),
      mergeMap(async (node) => validateNodeVisibility({ ...props, node })),
    ),
  );
  expect(props.expectedIds.every((nodeId) => nodesFound.includes(nodeId))).to.be.true;
}
