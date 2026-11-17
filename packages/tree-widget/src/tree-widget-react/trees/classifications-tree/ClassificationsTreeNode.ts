/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { ClassificationsTreeNode as TreeDefinitionsClassificationsTreeNode } from "@itwin/presentation-tree-definitions";

import type { Id64String } from "@itwin/core-bentley";
import type { HierarchyNode, InstancesNodeKey, NonGroupingHierarchyNode } from "@itwin/presentation-hierarchies";

/**
 * Contains utility functions for working with Classifications Tree nodes.
 * @beta
 */
export namespace ClassificationsTreeNode {
  /** Checks if the given node represents a `ClassificationSystems.ClassificationTable` element. */
  export const isClassificationTableNode = (node: Pick<HierarchyNode, "extendedData">): node is NonGroupingHierarchyNode & { key: InstancesNodeKey } =>
    TreeDefinitionsClassificationsTreeNode.isClassificationTableNode(node);

  /** Checks if the given node represents a `ClassificationSystems.Classification` element. */
  export const isClassificationNode = (node: Pick<HierarchyNode, "extendedData">): node is NonGroupingHierarchyNode & { key: InstancesNodeKey } =>
    TreeDefinitionsClassificationsTreeNode.isClassificationNode(node);

  /**
   * Checks if the given node represents a `BisCore.GeometricElement3d` element.
   *
   * If it does, the node's `extendedData` will contain the following properties:
   * - `modelId`: `Id64String` of the model containing the element
   * - `categoryId`: `Id64String` of the category of the element
   */
  export const isGeometricElementNode = (
    node: Pick<HierarchyNode, "extendedData">,
  ): node is Omit<NonGroupingHierarchyNode, "extendedData"> & { key: InstancesNodeKey } & {
    extendedData: {
      modelId: Id64String;
      categoryId: Id64String;
    };
  } => TreeDefinitionsClassificationsTreeNode.isGeometricElementNode(node);

  /** Returns type of the node. */
  export const getType = (node: HierarchyNode): "classification-table" | "classification" | "element" | undefined =>
    TreeDefinitionsClassificationsTreeNode.getType(node);
}
