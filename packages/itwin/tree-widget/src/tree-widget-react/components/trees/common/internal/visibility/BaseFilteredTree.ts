/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import type { HierarchyNode } from "@itwin/presentation-hierarchies";

/** @internal */
export interface FilteredVisibilityTargets<TFilterTargets> {
  targets?: TFilterTargets;
}

/** @internal */
export interface FilteredTree<TFilterTargets> {
  getFilterTargets(node: HierarchyNode): FilteredVisibilityTargets<TFilterTargets>;
}
