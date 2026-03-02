/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { EMPTY, expand, from, mergeMap } from "rxjs";
import { toVoidPromise } from "../../../tree-widget-react-internal.js";

import type { HierarchyNode, HierarchyProvider } from "@itwin/presentation-hierarchies";
import type { HierarchyVisibilityHandler } from "../../../tree-widget-react.js";
import type { Visibility } from "../../../tree-widget-react/components/trees/common/internal/Tooltip.js";
import type { TreeWidgetTestingViewport } from "../TreeUtils.js";

export interface VisibilityExpectations {
  [id: string]: Visibility | "disabled";
}

export interface ValidateNodeProps {
  handler: HierarchyVisibilityHandler;
  viewport: TreeWidgetTestingViewport;
  expectations: "all-visible" | "all-hidden" | VisibilityExpectations;
}

export async function validateHierarchyVisibility({
  provider,
  validateNodeVisibility,
  ...props
}: ValidateNodeProps & {
  provider: HierarchyProvider;
  validateNodeVisibility: (props: ValidateNodeProps & { node: HierarchyNode }) => Promise<void>;
}) {
  props.viewport.renderFrame();
  // This promise allows handler change event to fire if it was scheduled.
  await new Promise((resolve) => setTimeout(resolve));
  await toVoidPromise(
    from(provider.getNodes({ parentNode: undefined })).pipe(
      expand((node) => (node.children ? provider.getNodes({ parentNode: node }) : EMPTY)),
      mergeMap(async (node) => validateNodeVisibility({ ...props, node })),
    ),
  );
}
