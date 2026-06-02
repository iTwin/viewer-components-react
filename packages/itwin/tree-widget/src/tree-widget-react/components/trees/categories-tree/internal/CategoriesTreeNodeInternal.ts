/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { CategoriesTreeNode } from "../CategoriesTreeNode.js";

import type { Id64Array, Id64String } from "@itwin/core-bentley";
import type { ClassGroupingNodeKey, GroupingHierarchyNode, HierarchyNode, InstancesNodeKey, NonGroupingHierarchyNode } from "@itwin/presentation-hierarchies";
import type { CategoryId, ElementId } from "../../common/internal/Types.js";

/**
 * Contains utility functions for working with Models Tree nodes.
 *
 * It is a wrapper around `CategoriesTreeNode` that exposes some internal details that should not be exposed via public api.
 *
 * @internal
 */
export namespace CategoriesTreeNodeInternal {
  export const isDefinitionContainerNode = CategoriesTreeNode.isDefinitionContainerNode;

  export const isCategoryNode = (
    node: Pick<HierarchyNode, "extendedData">,
  ): node is Omit<NonGroupingHierarchyNode, "extendedData"> & { key: InstancesNodeKey } & {
    extendedData: CategoryNodeProps;
  } => CategoriesTreeNode.isCategoryNode(node);

  export const isModelNode = (node: Pick<HierarchyNode, "extendedData">): node is NonGroupingHierarchyNode & { key: InstancesNodeKey } =>
    CategoriesTreeNode.isModelNode(node);

  export const isElementNode = (
    node: Pick<HierarchyNode, "extendedData">,
  ): node is Omit<NonGroupingHierarchyNode, "extendedData"> & { key: InstancesNodeKey } & {
    extendedData: ElementNodeProps;
  } => CategoriesTreeNode.isElementNode(node);

  export const isElementClassGroupingNode = (
    node: Pick<HierarchyNode, "key">,
  ): node is Omit<GroupingHierarchyNode, "extendedData"> & { key: ClassGroupingNodeKey } & {
    extendedData: ElementClassGroupingNodeProps;
  } => CategoriesTreeNode.isElementClassGroupingNode(node);

  export const isSubCategoryNode = CategoriesTreeNode.isSubCategoryNode;
}

/**
 * @internal
 */
export interface CategoryNodeProps {
  description?: string;
  hasSubCategories?: boolean;
  parentElementsPath: Array<{ parentIds: Array<ElementId>; parentCategoryId: CategoryId }>;
  modelIds: Id64Array;
}

/**
 * @internal
 */
export interface ElementNodeProps {
  modelId: Id64String;
  categoryId: Id64String;
  parentElementsPath: Array<{ parentIds: Array<ElementId>; parentCategoryId: CategoryId }>;
}

/**
 * @internal
 */
export interface ElementClassGroupingNodeProps {
  categoryId: Id64String;
  parentElementsPath: Array<{ parentIds: Array<ElementId>; parentCategoryId: CategoryId }>;
  modelElementsMap: Map<Id64String, { elementIds: Set<Id64String>; childrenWhichAreParents: Set<ElementId> }>;
  hasDirectNonSearchTargets?: boolean;
  hasSearchTargetAncestor?: boolean;
}
