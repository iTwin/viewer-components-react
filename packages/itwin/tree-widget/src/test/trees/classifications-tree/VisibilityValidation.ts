/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { expect } from "chai";
import { EMPTY, expand, from, mergeMap } from "rxjs";
import { HierarchyNode } from "@itwin/presentation-hierarchies";
import { waitFor } from "@testing-library/react";
import { toVoidPromise } from "../../../tree-widget-react/components/trees/common/internal/Rxjs.js";

import type { Viewport } from "@itwin/core-frontend";
import type { HierarchyProvider } from "@itwin/presentation-hierarchies";
import type { Visibility } from "../../../tree-widget-react/components/trees/common/internal/Tooltip.js";
import type { HierarchyVisibilityHandler } from "../../../tree-widget-react/components/trees/common/UseHierarchyVisibility.js";

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
    expect(actualVisibility.state).to.eq(
      expectations === "all-hidden" ? "hidden" : "visible",
      `Expected [${node.label}] visibility to be ${expectations}, but got ${actualVisibility.state}`,
    );
    return;
  }

  if (!HierarchyNode.isInstancesNode(node)) {
    throw new Error(`Expected hierarchy to only have instance nodes, got ${JSON.stringify(node)}`);
  }

  const { id } = node.key.instanceKeys[0];
  if (expectations[id] !== undefined) {
    expect(actualVisibility.state).to.eq(expectations[id], `Expected [${node.label}] visibility to be ${expectations[id]}, but got ${actualVisibility.state}`);
  }
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
      mergeMap(async (node) => waitFor(async () => validateNodeVisibility({ ...props, node }))),
    ),
  );
}
