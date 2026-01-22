/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { ModelsTreeNode } from "../ModelsTreeNode.js";

import type { Id64String } from "@itwin/core-bentley";
import type { ClassGroupingNodeKey, GroupingHierarchyNode, HierarchyNode, InstancesNodeKey, NonGroupingHierarchyNode } from "@itwin/presentation-hierarchies";
import type { CategoryId } from "../../common/internal/Types.js";

/**
 * Contains utility functions for working with Models Tree nodes.
 *
 * It is a wrapper around `ModelsTreeNode` that exposes some internal details that should not be exposed via public api.
 *
 * @internal
 */
export namespace ModelsTreeNodeInternal {
  export const isSubjectNode = ModelsTreeNode.isSubjectNode;

  export const isModelNode = ModelsTreeNode.isModelNode;

  export const isCategoryNode = ModelsTreeNode.isCategoryNode;

  export const isElementNode = (
    node: Pick<HierarchyNode, "extendedData">,
  ): node is Omit<NonGroupingHierarchyNode, "extendedData"> & { key: InstancesNodeKey } & {
    extendedData: {
      modelId: Id64String;
      categoryId: Id64String;
      childrenCount: number;
      categoryOfElementOrParentElementWhichIsNotChild: CategoryId;
    };
  } => ModelsTreeNode.isElementNode(node);

  export const isElementClassGroupingNode = (
    node: Pick<HierarchyNode, "key">,
  ): node is Omit<GroupingHierarchyNode, "extendedData"> & { key: ClassGroupingNodeKey } & {
    extendedData: {
      modelId: Id64String;
      categoryId: Id64String;
      childrenCount: number;
      searchTargets?: Map<Id64String, { childrenCount: number }>;
      categoryOfElementOrParentElementWhichIsNotChild: CategoryId;
    };
  } => ModelsTreeNode.isElementClassGroupingNode(node);

  export const getType = ModelsTreeNode.getType;
}
