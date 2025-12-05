/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { CLASS_NAME_Classification, CLASS_NAME_ClassificationTable } from "../../../tree-widget-react/components/trees/common/internal/ClassNameDefinitions.js";

import type { Id64String } from "@itwin/core-bentley";
import type { NonGroupingHierarchyNode } from "@itwin/presentation-hierarchies";
import type { InstanceKey } from "@itwin/presentation-shared";

export function createClassificationTableHierarchyNode({
  id,
  hasChildren,
  filtering,
}: {
  id: Id64String;
  hasChildren?: boolean;
  filtering?: NonGroupingHierarchyNode["filtering"];
}): NonGroupingHierarchyNode {
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
    filtering,
  };
}

export function createClassificationHierarchyNode({
  id,
  hasChildren,
  filtering,
  parentKeys,
}: {
  id: Id64String;
  hasChildren?: boolean;
  filtering?: NonGroupingHierarchyNode["filtering"];
  parentKeys?: InstanceKey[];
}): NonGroupingHierarchyNode {
  return {
    key: {
      type: "instances",
      instanceKeys: [{ className: CLASS_NAME_Classification, id }],
    },
    label: "",
    parentKeys: parentKeys ? parentKeys.map((key) => ({ type: "instances", instanceKeys: [key] })) : [],
    children: !!hasChildren,
    extendedData: {
      type: "Classification",
    },
    filtering,
  };
}

export function createPhysicalElementHierarchyNode({
  id,
  modelId,
  categoryId,
  filtering,
  parentKeys,
}: {
  id: Id64String;
  modelId: Id64String;
  categoryId: Id64String;
  filtering?: NonGroupingHierarchyNode["filtering"];
  parentKeys?: InstanceKey[];
}): NonGroupingHierarchyNode {
  return {
    key: {
      type: "instances",
      instanceKeys: [{ className: "Generic.PhysicalObject", id }],
    },
    parentKeys: parentKeys ? parentKeys.map((key) => ({ type: "instances", instanceKeys: [key] })) : [],
    label: "",
    children: false,
    extendedData: {
      type: "GeometricElement3d",
      modelId,
      categoryId,
    },
    filtering,
  };
}

export function createDrawingElementHierarchyNode({
  id,
  modelId,
  categoryId,
  filtering,
  parentKeys,
}: {
  id: Id64String;
  modelId: Id64String;
  categoryId: Id64String;
  filtering?: NonGroupingHierarchyNode["filtering"];
  parentKeys?: InstanceKey[];
}): NonGroupingHierarchyNode {
  return {
    key: {
      type: "instances",
      instanceKeys: [{ className: "BisCore.DrawingGraphic", id }],
    },
    parentKeys: parentKeys ? parentKeys.map((key) => ({ type: "instances", instanceKeys: [key] })) : [],
    label: "",
    children: false,
    extendedData: {
      type: "GeometricElement2d",
      modelId,
      categoryId,
    },
    filtering,
  };
}
