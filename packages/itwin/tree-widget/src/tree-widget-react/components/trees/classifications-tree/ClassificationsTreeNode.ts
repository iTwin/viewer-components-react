/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import type { Id64String } from "@itwin/core-bentley";
import type { HierarchyNode, InstancesNodeKey, NonGroupingHierarchyNode } from "@itwin/presentation-hierarchies";

/**
 * Contains utility functions for working with Classifications Tree nodes.
 * @beta
 */
export namespace ClassificationsTreeNode {
  /** Checks if the given node represents a `ClassificationSystems.ClassificationTable` element. */
  export const isClassificationTableNode = (node: Pick<HierarchyNode, "extendedData">): node is NonGroupingHierarchyNode & { key: InstancesNodeKey } =>
    node.extendedData?.type === "ClassificationTable";

  /** Checks if the given node represents a `ClassificationSystems.Classification` element. */
  export const isClassificationNode = (node: Pick<HierarchyNode, "extendedData">): node is NonGroupingHierarchyNode & { key: InstancesNodeKey } =>
    node.extendedData?.type === "Classification";

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
  } => {
    return node.extendedData?.type === "GeometricElement3d";
  };
}
