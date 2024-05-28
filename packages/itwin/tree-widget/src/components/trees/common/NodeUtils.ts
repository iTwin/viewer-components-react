/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { NodeKey } from "@itwin/presentation-common";
import { isPresentationTreeNodeItem } from "@itwin/presentation-components";

import type { TreeNodeItem } from "@itwin/components-react";
import type { Id64String } from "@itwin/core-bentley";

/**
 * Models tree node types.
 * @public
 */
export enum ModelsTreeNodeType {
  Unknown,
  Subject,
  Model,
  Category,
  Element,
  Grouping,
}

interface Node {
  extendedData?: any;
}

/**
 * @public
 */
export namespace NodeUtils {
  /**
   * Determines a models tree node type.
   * @public
   */
  export function getNodeType(item: TreeNodeItem): ModelsTreeNodeType {
    if (!isPresentationTreeNodeItem(item)) {
      return ModelsTreeNodeType.Unknown;
    }

    if (NodeKey.isClassGroupingNodeKey(item.key)) {
      return ModelsTreeNodeType.Grouping;
    }

    if (!item.extendedData) {
      return ModelsTreeNodeType.Unknown;
    }

    if (isSubjectNode(item)) {
      return ModelsTreeNodeType.Subject;
    }
    if (isModelNode(item)) {
      return ModelsTreeNodeType.Model;
    }
    if (isCategoryNode(item)) {
      return ModelsTreeNodeType.Category;
    }
    return ModelsTreeNodeType.Element;
  }

  /**
   * Determines if a node represents a subject.
   * @public
   */
  export const isSubjectNode = (node: Node) => !!node.extendedData?.isSubject;

  /**
   * Determines if a node represents a model.
   * @public
   */
  export const isModelNode = (node: Node) => !!node.extendedData?.isModel;

  /**
   * Determines if a node represents a category.
   * @public
   */
  export const isCategoryNode = (node: Node) => !!node.extendedData?.isCategory;

  /**
   * Retrieves model ID from node's extended data.
   * @public
   */
  export const getModelId = (node: Node): Id64String | undefined => {
    if (node.extendedData?.modelId) {
      return node.extendedData?.modelId;
    }

    const modelIds = node.extendedData?.modelIds?.[0];
    return modelIds && (Array.isArray(modelIds) ? modelIds[0] : modelIds);
  };

  /**
   * Retrieves category ID from node's extended data.
   * @public
   */
  export const getElementCategoryId = (node: Node): Id64String | undefined => node.extendedData?.categoryId;
}
