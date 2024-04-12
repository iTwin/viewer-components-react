/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { NodeKey } from "@itwin/presentation-common";
import { isPresentationTreeNodeItem } from "@itwin/presentation-components";
import { ModelsTreeNodeType } from "./ModelsVisibilityHandler";

import type { TreeNodeItem } from "@itwin/components-react";
import type { Id64String } from "@itwin/core-bentley";

/**
 * Determines a models tree node type.
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

export const isSubjectNode = (node: TreeNodeItem) => !!node.extendedData?.isSubject;

export const isModelNode = (node: TreeNodeItem) => !!node.extendedData?.isModel;

export const isCategoryNode = (node: TreeNodeItem) => !!node.extendedData?.isCategory;

export const getCategoryParentModelId = (node: TreeNodeItem): Id64String | undefined => node.extendedData?.modelId;

export const getElementModelId = (node: TreeNodeItem): Id64String | undefined => node.extendedData?.modelId;

export const getElementCategoryId = (node: TreeNodeItem): Id64String | undefined => node.extendedData?.categoryId;
