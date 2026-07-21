/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { CLASS_NAME_Classification, CLASS_NAME_ClassificationTable } from "../../../tree-widget-react/components/trees/common/internal/ClassNameDefinitions.js";

import type { Id64String } from "@itwin/core-bentley";
import type { NonGroupingHierarchyNode } from "@itwin/presentation-hierarchies";
import type { InstanceKey } from "@itwin/presentation-shared";
import type { ParentElementsPath } from "../../../tree-widget-react/components/trees/common/internal/Utils.js";

export function createClassificationTableHierarchyNode({
  id,
  hasChildren,
  search,
}: {
  id: Id64String;
  hasChildren?: boolean;
  search?: NonGroupingHierarchyNode["search"];
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
      type: "classification-table",
    },
    search,
  };
}

export function createClassificationHierarchyNode({
  id,
  hasChildren,
  search,
  parentKeys,
}: {
  id: Id64String;
  hasChildren?: boolean;
  search?: NonGroupingHierarchyNode["search"];
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
      type: "classification",
    },
    search,
  };
}

export function createPhysicalElementHierarchyNode({
  id,
  modelId,
  categoryId,
  search,
  parentKeys,
  parentElementsPath,
}: {
  id: Id64String;
  modelId: Id64String;
  categoryId: Id64String;
  search?: NonGroupingHierarchyNode["search"];
  parentKeys?: InstanceKey[];
  parentElementsPath?: ParentElementsPath;
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
      type: "element",
      modelId,
      categoryId,
      parentElementsPath: parentElementsPath ?? [],
    },
    search,
  };
}
