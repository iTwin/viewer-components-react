/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { expect } from "chai";
import { EMPTY, expand, from, mergeMap } from "rxjs";
import { HierarchyNode } from "@itwin/presentation-hierarchies";
import { CategoriesTreeNode } from "../../../../tree-widget-react/components/trees/categories-tree/internal/CategoriesTreeNode.js";
import { toVoidPromise } from "../../../../tree-widget-react/components/trees/common/internal/Rxjs.js";

import type { Viewport } from "@itwin/core-frontend";
import type { HierarchyProvider } from "@itwin/presentation-hierarchies";
import type { Visibility } from "../../../../tree-widget-react/components/trees/common/internal/Tooltip.js";
import type { HierarchyVisibilityHandler } from "../../../../tree-widget-react/components/trees/common/UseHierarchyVisibility.js";
import type { Id64Array } from "@itwin/core-bentley";

export interface VisibilityExpectations {
  [id: string]: Visibility;
}

export interface ValidateNodeProps {
  handler: HierarchyVisibilityHandler;
  viewport: Viewport;
  expectations: "all-visible" | "all-hidden" | VisibilityExpectations;
}

export async function validateNodeVisibility({ node, handler, expectations }: ValidateNodeProps & { node: HierarchyNode }) {
  const actualVisibility = await handler.getVisibilityStatus(node);

  if (expectations === "all-hidden" || expectations === "all-visible") {
    expect(actualVisibility.state).to.eq(expectations === "all-hidden" ? "hidden" : "visible");
    return;
  }

  if (HierarchyNode.isClassGroupingNode(node)) {
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
        expect(actualVisibility.state).to.eq("partial");
        return;
      }
    }
    expect(actualVisibility.state).to.eq(visibleCount > 0 ? "visible" : "hidden");
    return;
  }

  if (!HierarchyNode.isInstancesNode(node)) {
    throw new Error(`Expected hierarchy to only have instance nodes, got ${JSON.stringify(node)}`);
  }

  const { id } = node.key.instanceKeys[0];

  if (CategoriesTreeNode.isSubCategoryNode(node)) {
    // One subCategory gets added when category is inserted
    if (expectations[id] !== undefined) {
      expect(actualVisibility.state).to.eq(expectations[id]);
    }
    return;
  }
  if (CategoriesTreeNode.isCategoryNode(node)) {
    const modelIds: Id64Array | undefined = node.extendedData?.modelIds;
    let idToUse = id;
    if (modelIds !== undefined) {
      idToUse = `${modelIds[0]}-${id}`;
    }
    expect(actualVisibility.state).to.eq(expectations[idToUse]);
    return;
  }
  if (CategoriesTreeNode.isModelNode(node) || CategoriesTreeNode.isDefinitionContainerNode(node) || CategoriesTreeNode.isElementNode(node)) {
    expect(actualVisibility.state).to.eq(expectations[id]);
    return;
  }
  throw new Error(`Expected hierarchy to contain only definitionContainers, categories, subcategories, models and elements got ${JSON.stringify(node)}`);
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
