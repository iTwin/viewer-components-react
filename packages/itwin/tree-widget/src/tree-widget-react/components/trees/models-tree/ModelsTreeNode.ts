/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { HierarchyNode, HierarchyNodeKey } from "@itwin/presentation-hierarchies";

import type { Id64String } from "@itwin/core-bentley";
import type { ClassGroupingNodeKey, GroupingHierarchyNode, InstancesNodeKey, NonGroupingHierarchyNode } from "@itwin/presentation-hierarchies";

/**
 * Contains utility functions for working with Models Tree nodes.
 * @beta
 */
export namespace ModelsTreeNode {
  /** Checks if the given node represents a `BisCore.Subject` element. */
  export const isSubjectNode = (node: Pick<HierarchyNode, "extendedData">): node is NonGroupingHierarchyNode & { key: InstancesNodeKey } =>
    !!node.extendedData?.isSubject;

  /** Checks if the given node represents a `BisCore.Model`. */
  export const isModelNode = (node: Pick<HierarchyNode, "extendedData">): node is NonGroupingHierarchyNode & { key: InstancesNodeKey } =>
    !!node.extendedData?.isModel;

  /**
   * Checks if the given node represents a `BisCore.Category` element.
   *
   * If it does, the node's `extendedData` will contain the following properties:
   * - `modelIds`: `Id64String[]` of the model that his category node is contained under
   */
  export const isCategoryNode = (
    node: Pick<HierarchyNode, "extendedData">,
  ): node is Omit<NonGroupingHierarchyNode, "extendedData"> & { key: InstancesNodeKey } & {
    extendedData: {
      modelIds: Id64String[];
    };
  } => !!node.extendedData?.isCategory;

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
  } => !!node.extendedData && "isElement" in node.extendedData && !!node.extendedData.isElement;

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
  } => HierarchyNode.isClassGroupingNode(node);

  /** Returns type of the node. */
  export const getType = (node: HierarchyNode): "subject" | "model" | "category" | "element" | "elements-class-group" => {
    if (HierarchyNodeKey.isClassGrouping(node.key)) {
      return "elements-class-group";
    }
    if (isSubjectNode(node)) {
      return "subject";
    }
    if (isModelNode(node)) {
      return "model";
    }
    if (isCategoryNode(node)) {
      return "category";
    }
    return "element";
  };
}
