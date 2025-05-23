/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import type { Id64String } from "@itwin/core-bentley";
import { assert } from "@itwin/core-bentley";
import { parseIdsSelectorResult } from "../../common/internal/Utils.js";

import type { HierarchyNodeKey } from "@itwin/presentation-hierarchies";

interface ClassificationsTreeNode {
  key: HierarchyNodeKey;
  extendedData?: { [id: string]: any };
}

/** @internal */
export namespace ClassificationsTreeNode {
  export const isClassificationTableNode = (node: Pick<ClassificationsTreeNode, "extendedData">) =>
    getNodeType(node) === "ClassificationTable";

  export const isClassificationNode = (node: Pick<ClassificationsTreeNode, "extendedData">) =>
    getNodeType(node) === "Classification";

  export const isCategoryNode = (node: Pick<ClassificationsTreeNode, "extendedData">) => {
    const type = getNodeType(node);
    return type === "SpatialCategory" || type === "DrawingCategory";
  }

  export const isGeometricElementNode = (node: Pick<ClassificationsTreeNode, "extendedData">) => {
    const type = getNodeType(node);
    return type === "GeometricElement3d" || type === "GeometricElement2d";
  }

  export const getClassificationIds = (node: Pick<ClassificationsTreeNode, "extendedData">): Id64String[] => {
    assert(!!node.extendedData && "classificationIds" in node.extendedData);
    return parseIdsSelectorResult(node.extendedData.classificationIds);
  }

  export const getModelId = (node: Pick<ClassificationsTreeNode, "extendedData">): Id64String => {
    assert(typeof node.extendedData?.modelId === "string");
    return node.extendedData.modelId;
  }

  export const getCategoryId = (node: Pick<ClassificationsTreeNode, "extendedData">): Id64String => {
    assert(typeof node.extendedData?.categoryId === "string");
    return node.extendedData.categoryId;
  }
}

function getNodeType(node: Pick<ClassificationsTreeNode, "extendedData">) {
  return node.extendedData && "type" in node.extendedData ? node.extendedData.type : undefined;
}
