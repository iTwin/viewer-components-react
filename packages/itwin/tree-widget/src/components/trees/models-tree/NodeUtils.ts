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
  export const isSubjectNode = (node: TreeNodeItem) => !!node.extendedData?.isSubject;

  /**
   * Determines if a node represents a model.
   * @public
   */
  export const isModelNode = (node: TreeNodeItem) => !!node.extendedData?.isModel;

  /**
   * Determines if a node represents a category.
   * @public
   */
  export const isCategoryNode = (node: TreeNodeItem) => !!node.extendedData?.isCategory;

  /**
   * Retrieves model ID from node's extended data.
   * @public
   */
  export const getModelId = (node: TreeNodeItem): Id64String | undefined => node.extendedData?.modelId;

  /**
   * Retrieves category ID from node's extended data.
   * @public
   */
  export const getElementCategoryId = (node: TreeNodeItem): Id64String | undefined => node.extendedData?.categoryId;
}
