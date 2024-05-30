/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import type { Id64String } from "@itwin/core-bentley";

interface ModelsTreeNode {
  extendedData?: any;
}

/**
 * @internal
 */
export namespace ModelsTreeNode {
  /**
   * Determines if a node represents a subject.
   */
  export const isSubjectNode = (node: ModelsTreeNode) => !!node.extendedData?.isSubject;

  /**
   * Determines if a node represents a model.
   */
  export const isModelNode = (node: ModelsTreeNode) => !!node.extendedData?.isModel;

  /**
   * Determines if a node represents a category.
   */
  export const isCategoryNode = (node: ModelsTreeNode) => !!node.extendedData?.isCategory;

  /**
   * Retrieves model ID from node's extended data.
   */
  export const getModelId = (node: ModelsTreeNode): Id64String | undefined => {
    if (node.extendedData?.modelId) {
      return node.extendedData?.modelId;
    }

    const modelIds = node.extendedData?.modelIds?.[0];
    return modelIds && (Array.isArray(modelIds) ? modelIds[0] : modelIds);
  };

  /**
   * Retrieves category ID from node's extended data.
   */
  export const getCategoryId = (node: ModelsTreeNode): Id64String | undefined => node.extendedData?.categoryId;
}
