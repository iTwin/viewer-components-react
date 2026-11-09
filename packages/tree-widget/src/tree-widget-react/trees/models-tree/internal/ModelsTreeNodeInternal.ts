/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { ModelsTreeNode } from "../ModelsTreeNode.js";

import type { Id64Array, Id64String } from "@itwin/core-bentley";
import type { ClassGroupingNodeKey, GroupingHierarchyNode, HierarchyNode, InstancesNodeKey, NonGroupingHierarchyNode } from "@itwin/presentation-hierarchies";
import type { ElementId } from "../../../shared/internal/Types.js";
import type { ParentElementsPath } from "../../../shared/internal/Utils.js";

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

  export const isCategoryNode = (
    node: Pick<HierarchyNode, "extendedData">,
  ): node is Omit<NonGroupingHierarchyNode, "extendedData"> & { key: InstancesNodeKey } & {
    extendedData: CategoryNodeProps;
  } => ModelsTreeNode.isCategoryNode(node);

  export const isRawCategoryNode = (
    node: Pick<HierarchyNode, "extendedData">,
  ): node is Omit<NonGroupingHierarchyNode, "extendedData"> & { key: InstancesNodeKey } & {
    extendedData: { [key: string]: any };
  } => ModelsTreeNode.isCategoryNode(node);

  export const isElementNode = (
    node: Pick<HierarchyNode, "extendedData">,
  ): node is Omit<NonGroupingHierarchyNode, "extendedData"> & { key: InstancesNodeKey } & {
    extendedData: ElementNodeProps;
  } => ModelsTreeNode.isElementNode(node);

  export const isRawElementNode = (
    node: Pick<HierarchyNode, "extendedData">,
  ): node is Omit<NonGroupingHierarchyNode, "extendedData"> & { key: InstancesNodeKey } & {
    extendedData: Pick<ElementNodeProps, "categoryId" | "modelId"> & { [key: string]: any };
  } => ModelsTreeNode.isElementNode(node);

  export const isElementClassGroupingNode = (
    node: Pick<HierarchyNode, "key">,
  ): node is Omit<GroupingHierarchyNode, "extendedData"> & { key: ClassGroupingNodeKey } & {
    extendedData: ElementClassGroupingNodeProps;
  } => ModelsTreeNode.isElementClassGroupingNode(node);

  export const isRawElementClassGroupingNode = (
    node: Pick<HierarchyNode, "key">,
  ): node is Omit<GroupingHierarchyNode, "extendedData"> & { key: ClassGroupingNodeKey } & {
    extendedData: Pick<ElementClassGroupingNodeProps, "categoryId" | "modelId"> & { [key: string]: any };
  } => ModelsTreeNode.isElementClassGroupingNode(node);

  export const getType = ModelsTreeNode.getType;
}

/**
 * @internal
 */
export interface CategoryNodeProps {
  parentElementsPath: ParentElementsPath;
  modelIds: Id64Array;
}

/**
 * @internal
 */
export interface ElementNodeProps {
  modelId: Id64String;
  categoryId: Id64String;
  parentElementsPath: ParentElementsPath;
}

/**
 * @internal
 */
export interface ElementClassGroupingNodeProps {
  modelId: Id64String;
  categoryId: Id64String;
  parentElementsPath: ParentElementsPath;
  childrenWhichAreParents: Set<ElementId>;
  hasDirectNonSearchTargets?: boolean;
  hasSearchTargetAncestor?: boolean;
}
