/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { ModelsTreeNode as TreeDefinitionsModelsTreeNode } from "@itwin/presentation-tree-definitions";

import type { Id64String } from "@itwin/core-bentley";
import type { ClassGroupingNodeKey, GroupingHierarchyNode, HierarchyNode, InstancesNodeKey, NonGroupingHierarchyNode } from "@itwin/presentation-hierarchies";

/**
 * Contains utility functions for working with Models Tree nodes.
 * @beta
 */
export namespace ModelsTreeNode {
  /** Checks if the given node represents a `BisCore.Subject` element. */
  export const isSubjectNode = (node: Pick<HierarchyNode, "extendedData">): node is NonGroupingHierarchyNode & { key: InstancesNodeKey } =>
    TreeDefinitionsModelsTreeNode.isSubjectNode(node);

  /** Checks if the given node represents a `BisCore.Model`. */
  export const isModelNode = (node: Pick<HierarchyNode, "extendedData">): node is NonGroupingHierarchyNode & { key: InstancesNodeKey } =>
    TreeDefinitionsModelsTreeNode.isModelNode(node);

  /**
   * Checks if the given node represents a `BisCore.Category` element.
   *
   * If it does, the node's `extendedData` will contain the following properties:
   * - `modelIds`: `Id64String[]` of the model that this category node is contained under
   */
  export const isCategoryNode = (
    node: Pick<HierarchyNode, "extendedData">,
  ): node is Omit<NonGroupingHierarchyNode, "extendedData"> & { key: InstancesNodeKey } & {
    extendedData: {
      modelIds: Id64String[];
    };
  } => TreeDefinitionsModelsTreeNode.isCategoryNode(node);

  /**
   * Checks if the given node represents a `BisCore.GeometricElement` element.
   *
   * If it does, the node's `extendedData` will contain the following properties:
   * - `modelId`: `Id64String` of the model containing the element
   * - `categoryId`: `Id64String` of the category of the element
   */
  export const isElementNode = (
    node: Pick<HierarchyNode, "extendedData">,
  ): node is Omit<NonGroupingHierarchyNode, "extendedData"> & { key: InstancesNodeKey } & {
    extendedData: {
      modelId: Id64String;
      categoryId: Id64String;
    };
  } => TreeDefinitionsModelsTreeNode.isElementNode(node);

  /**
   * Checks if the given node is a class grouping node of `BisCore.GeometricElement` nodes.
   *
   * If it is, the node's `extendedData` will contain the following properties:
   * - `modelId`: `Id64String` of the model containing the elements
   * - `categoryId`: `Id64String` of the category of the elements
   */
  export const isElementClassGroupingNode = (
    node: Pick<HierarchyNode, "key">,
  ): node is Omit<GroupingHierarchyNode, "extendedData"> & { key: ClassGroupingNodeKey } & {
    extendedData: {
      modelId: Id64String;
      categoryId: Id64String;
    };
  } => TreeDefinitionsModelsTreeNode.isElementClassGroupingNode(node);

  /** Returns type of the node. */
  export const getType = (node: HierarchyNode): "subject" | "model" | "category" | "element" | "elements-class-group" | undefined =>
    TreeDefinitionsModelsTreeNode.getType(node);
}
