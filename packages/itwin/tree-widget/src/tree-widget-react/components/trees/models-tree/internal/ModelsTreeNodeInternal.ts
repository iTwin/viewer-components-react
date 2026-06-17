/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { ModelsTreeNode } from "../ModelsTreeNode.js";

import type { Id64String } from "@itwin/core-bentley";
import type { ClassGroupingNodeKey, GroupingHierarchyNode, HierarchyNode, InstancesNodeKey, NonGroupingHierarchyNode } from "@itwin/presentation-hierarchies";
import type { CategoryId, ElementId } from "../../common/internal/Types.js";

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

  export const isRawCategoryNode = ModelsTreeNode.isCategoryNode;

  export const isElementNode = (
    node: Pick<HierarchyNode, "extendedData">,
  ): node is Omit<NonGroupingHierarchyNode, "extendedData"> & { key: InstancesNodeKey } & {
    extendedData: ElementNodeProps;
  } => ModelsTreeNode.isElementNode(node);

  export const isRawElementNode = (
    node: Pick<HierarchyNode, "extendedData">,
  ): node is Omit<NonGroupingHierarchyNode, "extendedData"> & { key: InstancesNodeKey } & {
    extendedData: ElementNodeProps & { [key: string]: any };
  } => ModelsTreeNode.isElementNode(node);

  export const isElementClassGroupingNode = (
    node: Pick<HierarchyNode, "key">,
  ): node is Omit<GroupingHierarchyNode, "extendedData"> & { key: ClassGroupingNodeKey } & {
    extendedData: ElementClassGroupingNodeProps;
  } => ModelsTreeNode.isElementClassGroupingNode(node);

  export const getType = ModelsTreeNode.getType;
}

/**
 * @internal
 */
export interface ElementNodeProps {
  modelId: Id64String;
  categoryId: Id64String;
  categoryOfTopMostParentElement: CategoryId;
  topMostParentElementId: Id64String;
}

/**
 * @internal
 */
export interface ElementClassGroupingNodeProps {
  modelId: Id64String;
  categoryId: Id64String;
  categoryOfTopMostParentElement: CategoryId;
  topMostParentElementId?: Id64String;
  childrenWhichAreParents: Set<ElementId>;
  hasDirectNonSearchTargets?: boolean;
  hasSearchTargetAncestor?: boolean;
}
