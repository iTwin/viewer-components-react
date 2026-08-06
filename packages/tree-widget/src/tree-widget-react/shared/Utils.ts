/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { HierarchySearchTree } from "@itwin/presentation-hierarchies";

/**
 * This is a logging namespace for public log messages that may be interesting to consumers.
 * @internal
 */
export const LOGGING_NAMESPACE = "TreeWidget";

/** @beta */
export type FunctionProps<THook extends (props: any) => any> = Parameters<THook>[0];

/** @internal */
export function joinHierarchySearchTrees(subTrees: HierarchySearchTree[], searchTrees: HierarchySearchTree[]): HierarchySearchTree[] {
  const builder = HierarchySearchTree.createBuilder<{
    isSubTreeTarget?: boolean;
    isSubTreeNode?: boolean;
    isSearchTreeNode?: boolean;
    isSearchTarget?: boolean;
    isSearchTargetAncestor?: boolean;
  }>();

  for (const subTree of subTrees) {
    builder.accept({
      tree: subTree,
      handler: {
        onEntryHandled: ({ treeEntry, inputEntry }) => {
          // Assign extra information to the entry
          treeEntry.extras.isSubTreeTarget ||= inputEntry.isTarget || !inputEntry.hasChildren;
          treeEntry.extras.isSubTreeNode = true;
        },
      },
    });
  }
  for (const searchTree of searchTrees) {
    builder.accept({
      tree: searchTree,
      handler: {
        onNewEntry: ({ parentEntries }) => {
          // Only allow adding new entries under sub-tree targets
          const hasSubTreeAncestor = parentEntries.find((entry) => entry.extras.isSubTreeTarget) !== undefined;
          if (!hasSubTreeAncestor) {
            return false;
          }
          // When adding an search-tree entry under a sub-tree, remove the `isTarget` flag - search-tree is more specific.
          //
          // Covers the following case:
          // - sub-tree: [a]
          // - search-tree: [a, b]
          // - expected result:
          //   - a (NOT a target)
          //     - b (implied target)
          const lastEntry = parentEntries[parentEntries.length - 1];
          if (lastEntry?.extras.isSubTreeNode && !lastEntry.extras.isSearchTarget) {
            delete lastEntry.isTarget;
          }
          return true;
        },
        onEntryHandled: ({ treeEntry, inputEntry, parentEntries }) => {
          // Assign extra information to the entry
          treeEntry.extras.isSearchTarget ||= inputEntry.isTarget || !inputEntry.hasChildren;
          treeEntry.extras.isSearchTreeNode = true;

          // Mark all ancestors of search-tree target as search-target-ancestors. This will allow us to keep them in the tree
          // even if they are not sub-tree targets themselves.
          if (treeEntry.extras.isSearchTarget) {
            parentEntries.forEach((parentEntry) => {
              parentEntry.extras.isSearchTargetAncestor = true;
            });
          }

          // If we merged a search-tree entry with sub-tree entry - ensure it doesn't have the `isTarget` flag. Any sub-tree
          // entry must also be a sub-tree target to have the `isTarget` flag.
          //
          // Covers the following case:
          // - sub-tree: [a, b]
          // - search-tree: [a]
          // - expected result:
          //   - a (NOT a target)
          //     - b (implied target)
          if (treeEntry.extras.isSubTreeNode && !treeEntry.extras.isSubTreeTarget) {
            delete treeEntry.isTarget;
          }
        },
      },
    });
  }
  return builder.getTree({
    processEntry: ({ treeEntry, parentEntries }) =>
      // Only include entries that are on the path to search-tree targets. This will allow us to exclude sub-tree branches that are not relevant to search results.
      treeEntry.extras.isSearchTargetAncestor || treeEntry.extras.isSearchTarget || parentEntries.some((parentEntry) => parentEntry.extras.isSearchTarget)
        ? treeEntry
        : undefined,
  });
}
