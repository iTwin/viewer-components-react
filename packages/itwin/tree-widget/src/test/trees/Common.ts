/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { PropertyRecord, PropertyValueFormat } from "@itwin/appui-abstract";
import { Id64 } from "@itwin/core-bentley";
import { CheckBoxState } from "@itwin/core-react";
import { StandardNodeTypes } from "@itwin/presentation-common";
import { TREE_NODE_LABEL_RENDERER } from "../../components/trees/common/TreeNodeRenderer";

import type { PropertyDescription, PropertyValue } from "@itwin/appui-abstract";
import type { TreeModelNode } from "@itwin/components-react";
import type { Id64String } from "@itwin/core-bentley";
import type { ECClassGroupingNodeKey, ECInstancesNodeKey, InstanceKey } from "@itwin/presentation-common";
import type { PresentationTreeNodeItem } from "@itwin/presentation-components";

export const createSimpleTreeModelNode = (id?: string, labelValue?: string, node?: Partial<TreeModelNode>): TreeModelNode => {
  const label = createPropertyRecord({ valueFormat: PropertyValueFormat.Primitive, value: labelValue ?? "Node Label" });
  label.property.renderer = { name: TREE_NODE_LABEL_RENDERER };

  return {
    id: id || "testId",
    parentId: undefined,
    depth: 1,

    isLoading: undefined,
    numChildren: undefined,

    description: undefined,
    isExpanded: true,
    label,
    isSelected: true,

    checkbox: {
      state: CheckBoxState.On,
      isDisabled: false,
      isVisible: true,
    },

    item: {
      id: "node-id",
      label,
    },
    ...node,
  };
};

export const createSubjectNode = (ids?: Id64String | Id64String[]): PresentationTreeNodeItem => ({
  key: createKey("subject", ids ? ids : "subject_id"),
  id: "subject",
  label: PropertyRecord.fromString("subject"),
  extendedData: {
    isSubject: true,
  },
});

export const createModelNode = (): PresentationTreeNodeItem => ({
  key: createKey("model", "model_id"),
  id: "model",
  label: PropertyRecord.fromString("model"),
  extendedData: {
    isModel: true,
  },
});

export const createCategoryNode = (parentModelKey?: InstanceKey): PresentationTreeNodeItem => ({
  key: createKey("category", "category_id"),
  id: "category",
  parentId: "model",
  label: PropertyRecord.fromString("category"),
  extendedData: {
    isCategory: true,
    modelId: parentModelKey ? parentModelKey.id : undefined,
  },
});

export const createElementClassGroupingNode = (elementIds: Id64String[]): PresentationTreeNodeItem => ({
  key: createClassGroupingKey(elementIds),
  id: "element_class_grouping",
  label: PropertyRecord.fromString("grouping"),
});

export const createElementNode = (modelId?: Id64String, categoryId?: Id64String): PresentationTreeNodeItem => ({
  key: createKey("element", "element_id"),
  id: "element",
  label: PropertyRecord.fromString("element"),
  extendedData: {
    modelId,
    categoryId,
  },
});

export const createKey = (type: "subject" | "model" | "category" | "element", ids: Id64String | Id64String[]): ECInstancesNodeKey => {
  let className: string;
  switch (type) {
    case "subject":
      className = "MyDomain:Subject";
      break;
    case "model":
      className = "MyDomain:PhysicalModel";
      break;
    case "category":
      className = "MyDomain:SpatialCategory";
      break;
    default:
      className = "MyDomain:SomeElementType";
  }
  const instanceKeys = new Array<InstanceKey>();
  for (const id of Id64.iterable(ids)) {
    instanceKeys.push({ className, id });
  }

  return {
    type: StandardNodeTypes.ECInstancesNode,
    version: 0,
    instanceKeys,
    pathFromRoot: [],
  };
};

export const createClassGroupingKey = (ids: Id64String[]): ECClassGroupingNodeKey => {
  return {
    type: StandardNodeTypes.ECClassGroupingNode,
    version: 0,
    className: "MyDomain:SomeElementType",
    groupedInstancesCount: Array.isArray(ids) ? ids.length : 1,
    pathFromRoot: [],
  };
};

function createPropertyRecord(value?: PropertyValue, description?: Partial<PropertyDescription>): PropertyRecord {
  const propertyValue: PropertyValue = value ?? {
    valueFormat: PropertyValueFormat.Primitive,
    value: "test-value",
  };
  const propertyDescription: PropertyDescription = {
    ...description,
    name: description?.name ?? "property-name",
    displayLabel: description?.displayLabel ?? "Property Label",
    typename: description?.typename ?? "string",
  };
  return new PropertyRecord(propertyValue, propertyDescription);
}
