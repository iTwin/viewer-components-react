/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { ClassificationsTreeNode } from "../ClassificationsTreeNode.js";

import type { Id64String } from "@itwin/core-bentley";
import type { HierarchyNode, InstancesNodeKey, NonGroupingHierarchyNode } from "@itwin/presentation-hierarchies";

/**
 * Contains utility functions for working with Classifications Tree nodes.
 *
 * It is a wrapper around `ClassificationsTreeNode` that exposes some internal details that should not be exposed via public api.
 *
 * @internal
 */
export namespace ClassificationsTreeNodeInternal {
  export const isClassificationTableNode = ClassificationsTreeNode.isClassificationTableNode;

  export const isClassificationNode = ClassificationsTreeNode.isClassificationNode;

  export const isGeometricElementNode = (
    node: Pick<HierarchyNode, "extendedData">,
  ): node is Omit<NonGroupingHierarchyNode, "extendedData"> & { key: InstancesNodeKey } & {
    extendedData: {
      type: "GeometricElement3d" | "GeometricElement2d";
      modelId: Id64String;
      categoryId: Id64String;
      childrenCount: number;
      categoryOfTopMostParentElement: Id64String;
      topMostParentElementId: Id64String;
    };
  } => ClassificationsTreeNode.isGeometricElementNode(node);
}
