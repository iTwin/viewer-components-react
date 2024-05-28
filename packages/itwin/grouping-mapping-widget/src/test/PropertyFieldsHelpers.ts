/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
import { Field, NestedContentField, PropertiesField, PropertyValueFormat } from "@itwin/presentation-common";
import type {
  CategoryDescription,
  ClassInfo,
  EditorDescription,
  Property,
  PropertyInfo,
  RelatedClassInfo,
  RelationshipMeaning,
  RelationshipPath,
  RendererDescription,
  StructTypeDescription,
  TypeDescription,
} from "@itwin/presentation-common";

export const createTestPropertyInfo = (props?: Partial<PropertyInfo>) => ({
  classInfo: createTestECClassInfo(),
  name: "PropertyName",
  type: "string",
  ...props,
});

export const createTestCategoryDescription = (props?: Partial<CategoryDescription>) => ({
  name: "test-category",
  label: "Test Category",
  description: "Test category description",
  priority: 0,
  expand: false,
  ...props,
});

export const createTestECClassInfo = (props?: Partial<ClassInfo>) => ({
  id: "0x1",
  name: "SchemaName:ClassName",
  label: "Class Label",
  ...props,
});

export const createTestRelationshipPath = (length: number = 2) => {
  const path = new Array<RelatedClassInfo>();
  while (length--) path.push(createTestRelatedClassInfo());
  return path;
};

export const createTestRelatedClassInfo = (props?: Partial<RelatedClassInfo>) => ({
  sourceClassInfo: createTestECClassInfo({ id: "0x1", name: "source:class", label: "Source" }),
  targetClassInfo: createTestECClassInfo({ id: "0x2", name: "target:class", label: "Target" }),
  isPolymorphicTargetClass: false,
  relationshipInfo: createTestECClassInfo({ id: "0x3", name: "relationship:class", label: "Relationship" }),
  isForwardRelationship: false,
  isPolymorphicRelationship: false,
  ...props,
});

export const createTestSimpleContentField = (props?: {
  category?: CategoryDescription;
  type?: TypeDescription;
  name?: string;
  label?: string;
  isReadonly?: boolean;
  priority?: number;
  editor?: EditorDescription;
  renderer?: RendererDescription;
}) => {
  return new Field(
    props?.category ?? createTestCategoryDescription(),
    props?.name ?? "SimpleField",
    props?.label ?? "Simple Field",
    props?.type ?? {
      valueFormat: PropertyValueFormat.Primitive,
      typeName: "string",
    },
    props?.isReadonly ?? false,
    props?.priority ?? 0,
    props?.editor,
    props?.renderer,
  );
};

export const createTestPropertiesContentField = (props: {
  properties: Property[];
  category?: CategoryDescription;
  type?: TypeDescription;
  name?: string;
  label?: string;
  isReadonly?: boolean;
  priority?: number;
  editor?: EditorDescription;
  renderer?: RendererDescription;
}) => {
  return new PropertiesField(
    props.category ?? createTestCategoryDescription(),
    props.name ?? "PropertiesField",
    props.label ?? "Properties Field",
    props.type ?? { valueFormat: PropertyValueFormat.Primitive, typeName: "string" },
    props.isReadonly ?? false,
    props.priority ?? 0,
    props.properties,
    props.editor,
    props.renderer,
  );
};

export const createTestNestedContentField = (props: {
  nestedFields: Field[];
  category?: CategoryDescription;
  name?: string;
  label?: string;
  isReadonly?: boolean;
  priority?: number;
  contentClassInfo?: ClassInfo;
  pathToPrimaryClass?: RelationshipPath;
  autoExpand?: boolean;
  editor?: EditorDescription;
  renderer?: RendererDescription;
  relationshipMeaning?: RelationshipMeaning;
}) => {
  const nestedContentFieldType: StructTypeDescription = {
    valueFormat: PropertyValueFormat.Struct,
    typeName: "NestedContentFieldType",
    members: props.nestedFields.map((f) => ({
      name: f.name,
      label: f.label,
      type: f.type,
    })),
  };
  const field = new NestedContentField(
    props.category ?? createTestCategoryDescription(),
    props.name ?? "NestedContentField",
    props.label ?? "Nested Content",
    nestedContentFieldType,
    props.isReadonly ?? false,
    props.priority ?? 0,
    props.contentClassInfo ?? createTestECClassInfo(),
    props.pathToPrimaryClass ?? createTestRelationshipPath(1),
    props.nestedFields,
    props.editor,
    !!props.autoExpand,
    props.renderer,
  );
  if (props.relationshipMeaning) field.relationshipMeaning = props.relationshipMeaning;
  field.rebuildParentship();
  return field;
};
