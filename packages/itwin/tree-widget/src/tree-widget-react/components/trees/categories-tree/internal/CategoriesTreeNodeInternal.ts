/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { CategoriesTreeNode } from "../CategoriesTreeNode.js";

import type { Id64Array, Id64String } from "@itwin/core-bentley";
import type { ClassGroupingNodeKey, GroupingHierarchyNode, HierarchyNode, InstancesNodeKey, NonGroupingHierarchyNode } from "@itwin/presentation-hierarchies";

/**
 * Contains utility functions for working with Models Tree nodes.
 *
 * It is a wrapper around `CategoriesTreeNode` that exposes some internal details that should not be exposed vie public api.
 *
 * @internal
 */
export namespace CategoriesTreeNodeInternal {
  export const isDefinitionContainerNode = CategoriesTreeNode.isDefinitionContainerNode;

  export const isCategoryNode = (
    node: Pick<HierarchyNode, "extendedData">,
  ): node is Omit<NonGroupingHierarchyNode, "extendedData"> & { key: InstancesNodeKey } & {
    extendedData: {
      description?: string;
      hasSubCategories?: boolean;
    } & (
      | {
          isCategoryOfSubModel?: false;
        }
      | {
          modelIds: Id64Array;
          isCategoryOfSubModel: true;
        }
    );
  } => CategoriesTreeNode.isCategoryNode(node);

  export const isModelNode = (node: Pick<HierarchyNode, "extendedData">): node is NonGroupingHierarchyNode & { key: InstancesNodeKey } =>
    CategoriesTreeNode.isModelNode(node);

  export const isElementNode = (
    node: Pick<HierarchyNode, "extendedData">,
  ): node is Omit<NonGroupingHierarchyNode, "extendedData"> & { key: InstancesNodeKey } & {
    extendedData: {
      modelId: Id64String;
      categoryId: Id64String;
      childrenCount: number;
      categoryOfElementOrParentElementWhichIsNotChild: Id64String;
    };
  } => CategoriesTreeNode.isElementNode(node);

  export const isElementClassGroupingNode = (
    node: Pick<HierarchyNode, "key">,
  ): node is Omit<GroupingHierarchyNode, "extendedData"> & { key: ClassGroupingNodeKey } & {
    extendedData: {
      categoryId: Id64String;
      modelElementsMap: Map<Id64String, { elementIds: Set<Id64String>; categoryOfElementOrParentElementWhichIsNotChild: Id64String }>;
      childrenCount: number;
      searchTargets?: Map<Id64String, { childrenCount: number }>;
    };
  } => CategoriesTreeNode.isElementClassGroupingNode(node);

  export const isSubCategoryNode = CategoriesTreeNode.isSubCategoryNode;
}
