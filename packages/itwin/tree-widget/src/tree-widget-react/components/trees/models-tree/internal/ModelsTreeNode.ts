/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { HierarchyNodeKey } from "@itwin/presentation-hierarchies";

import type { Id64String } from "@itwin/core-bentley";

interface ModelsTreeNode {
  key: HierarchyNodeKey;
  extendedData?: { [id: string]: any };
}

/**
 * @internal
 */
export namespace ModelsTreeNode {
  /**
   * Determines if a node represents a subject.
   */
  export const isSubjectNode = (node: Pick<ModelsTreeNode, "extendedData">) => !!node.extendedData?.isSubject;

  /**
   * Determines if a node represents a model.
   */
  export const isModelNode = (node: Pick<ModelsTreeNode, "extendedData">) => !!node.extendedData?.isModel;

  /**
   * Determines if a node represents a category.
   */
  export const isCategoryNode = (node: Pick<ModelsTreeNode, "extendedData">) => !!node.extendedData?.isCategory;

  /** Returns type of the node. */
  export const getType = (node: ModelsTreeNode): "subject" | "model" | "category" | "element" | "elements-class-group" => {
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

  /**
   * Retrieves model ID from node's extended data.
   */
  export const getModelId = (node: Pick<ModelsTreeNode, "extendedData">): Id64String | undefined => {
    if (node.extendedData?.modelId) {
      return node.extendedData?.modelId;
    }

    const modelIds = node.extendedData?.modelIds?.[0];
    return modelIds && (Array.isArray(modelIds) ? modelIds[0] : modelIds);
  };

  /**
   * Retrieves category ID from node's extended data.
   */
  export const getCategoryId = (node: Pick<ModelsTreeNode, "extendedData">): Id64String | undefined => node.extendedData?.categoryId;
}
