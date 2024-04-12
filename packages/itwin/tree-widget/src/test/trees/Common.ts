/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { PropertyRecord, PropertyValueFormat } from "@itwin/appui-abstract";
import { Id64 } from "@itwin/core-bentley";
import { CheckBoxState } from "@itwin/core-react";
import { Descriptor, PropertiesField, StandardNodeTypes } from "@itwin/presentation-common";
import { InfoTreeNodeItemType } from "@itwin/presentation-components";
import { TREE_NODE_LABEL_RENDERER } from "../../components/trees/common/TreeNodeRenderer";

import type { PropertyDescription, PropertyValue } from "@itwin/appui-abstract";
import type { TreeModelNode, TreeNodeItem } from "@itwin/components-react";
import type { Id64String } from "@itwin/core-bentley";
import type {
  CategoryDescription,
  ClassInfo,
  DescriptorSource,
  ECClassGroupingNodeKey,
  ECInstancesNodeKey,
  EditorDescription,
  Field,
  InstanceKey,
  PrimitiveTypeDescription,
  Property,
  PropertyInfo,
  RendererDescription,
  SelectClassInfo,
  TypeDescription,
} from "@itwin/presentation-common";
import type { PresentationInfoTreeNodeItem, PresentationTreeNodeItem } from "@itwin/presentation-components";

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

export const createTestSelectClassInfo = (props?: Partial<SelectClassInfo>) => ({
  selectClassInfo: createTestECClassInfo(),
  isSelectPolymorphic: false,
  ...props,
});

export function createTestContentDescriptor(props: Partial<DescriptorSource> & { fields: Field[] }) {
  return new Descriptor({
    connectionId: "",
    displayType: "",
    contentFlags: 0,
    selectClasses: [createTestSelectClassInfo()],
    categories: [createTestCategoryDescription()],
    ...props,
  });
}

export function createPresentationTreeNodeItem(item?: Partial<PresentationTreeNodeItem>): PresentationTreeNodeItem {
  return {
    id: item?.id ?? "node_id",
    key: item?.key ?? createTestECInstancesNodeKey(),
    label: item?.label ?? PropertyRecord.fromString("Node Label"),
    ...item,
  };
}

export function createInfoNode(parentNode: TreeNodeItem | undefined, message: string, type?: InfoTreeNodeItemType): PresentationInfoTreeNodeItem {
  const id = parentNode ? `${parentNode.id}/info-node` : `/info-node/${message}`;
  return {
    id,
    parentId: parentNode?.id,
    label: PropertyRecord.fromString(message),
    message,
    isSelectionDisabled: true,
    children: undefined,
    type: type ?? InfoTreeNodeItemType.Unset,
  };
}

export function createTestECInstancesNodeKey(key?: Partial<ECInstancesNodeKey>): ECInstancesNodeKey {
  return {
    type: StandardNodeTypes.ECInstancesNode,
    version: 2,
    pathFromRoot: key?.pathFromRoot ?? ["parentHash", "childHash"],
    instanceKeys: key?.instanceKeys ?? [createTestECInstanceKey(), createTestECInstanceKey()],
  };
}

export function createTestECInstanceKey(key?: Partial<InstanceKey>): InstanceKey {
  return {
    className: key?.className ?? "TestSchema:TestClass",
    id: key?.id ?? "0x1",
  };
}

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

export const createElementNode = (modelId?: Id64String, categoryId?: Id64String, hasChildren?: boolean): PresentationTreeNodeItem => ({
  key: createKey("element", "element_id"),
  id: "element",
  label: PropertyRecord.fromString("element"),
  extendedData: {
    modelId,
    categoryId,
  },
  hasChildren: hasChildren ?? true,
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

export const createTestECClassInfo = (props?: Partial<ClassInfo>) => ({
  id: "0x1",
  name: "SchemaName:ClassName",
  label: "Class Label",
  ...props,
});

export const createTestPropertyInfo = (props?: Partial<PropertyInfo>) => ({
  classInfo: createTestECClassInfo(),
  name: "PropertyName",
  type: "string",
  ...props,
});

export function createTestPropertiesContentField(props: {
  properties: Property[];
  category?: CategoryDescription;
  type?: TypeDescription;
  name?: string;
  label?: string;
  isReadonly?: boolean;
  priority?: number;
  editor?: EditorDescription;
  renderer?: RendererDescription;
}) {
  return new PropertiesField(
    props.category ?? createTestCategoryDescription(),
    props.name ?? "PropertiesField",
    props.label ?? "Properties Field",
    props.type ?? ({ valueFormat: "Primitive", typeName: "Primitive" } as PrimitiveTypeDescription),
    props.isReadonly ?? false,
    props.priority ?? 0,
    props.properties,
    props.editor,
    props.renderer,
  );
}

export const createTestCategoryDescription = (props?: Partial<CategoryDescription>) => ({
  ...props,
  name: "test-category",
  label: "Test Category",
  description: "Test category description",
  priority: 0,
  expand: false,
});

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
