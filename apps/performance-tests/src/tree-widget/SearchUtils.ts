/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import type { HierarchySearchTree } from "@itwin/presentation-hierarchies";

export function countSearchTargets(trees: HierarchySearchTree[]): number {
  return trees.reduce((sum, entry) => {
    if (entry.isTarget || !entry.children) {
      sum += 1;
    }
    if (entry.children) {
      sum += countSearchTargets(entry.children);
    }
    return sum;
  }, 0);
}
