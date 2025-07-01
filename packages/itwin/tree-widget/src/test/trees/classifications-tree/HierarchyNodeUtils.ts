/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import {
  CLASS_NAME_Classification, CLASS_NAME_ClassificationTable,
} from "../../../tree-widget-react/components/trees/common/internal/ClassNameDefinitions.js";

import type { Id64String } from "@itwin/core-bentley";
import type { NonGroupingHierarchyNode } from "@itwin/presentation-hierarchies";

export function createClassificationTableHierarchyNode(
  {id, hasChildren}: {id: Id64String; hasChildren?: boolean},
): NonGroupingHierarchyNode {
  return {
    key: {
      type: "instances",
      instanceKeys: [{ className: CLASS_NAME_ClassificationTable, id }],
    },
    label: "",
    parentKeys: [],
    children: !!hasChildren,
    extendedData: {
      type: "ClassificationTable",
    },
  };
}

export function createClassificationHierarchyNode(
  {id, hasChildren}: {id: Id64String; hasChildren?: boolean}
): NonGroupingHierarchyNode {
  return {
    key: {
      type: "instances",
      instanceKeys: [{ className: CLASS_NAME_Classification, id }],
    },
    label: "",
    parentKeys: [],
    children: !!hasChildren,
    extendedData: {
      type: "Classification",
    },
  };
}

export function createPhysicalElementHierarchyNode({id, modelId, categoryId}: {id: Id64String; modelId: Id64String; categoryId: Id64String}): NonGroupingHierarchyNode {
  return {
    key: {
      type: "instances",
      instanceKeys: [{ className: "Generic.PhysicalObject", id }],
    },
    parentKeys: [],
    label: "",
    children: false,
    extendedData: {
      type: "GeometricElement3d",
      modelId,
      categoryId,
    },
  };
}

export function createDrawingElementHierarchyNode({id, modelId, categoryId}: {id: Id64String; modelId: Id64String; categoryId: Id64String}): NonGroupingHierarchyNode {
  return {
    key: {
      type: "instances",
      instanceKeys: [{ className: "BisCore.DrawingGraphic", id }],
    },
    parentKeys: [],
    label: "",
    children: false,
    extendedData: {
      type: "GeometricElement2d",
      modelId,
      categoryId,
    },
  };
}
