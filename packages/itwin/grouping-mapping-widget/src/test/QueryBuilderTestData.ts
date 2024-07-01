/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
import type { PropertyDescription, PropertyValue } from "@itwin/appui-abstract";
import type { FieldDescriptorType, RelationshipPath } from "@itwin/presentation-common";

export interface ClassInfoTestData {
  name: string;
}

export interface NavigationPropertyInfoTestData {
  classInfo: ClassInfoTestData;
}

export interface PropertyTestData {
  name: string;
  classInfo: ClassInfoTestData;
  navigationPropertyInfo?: NavigationPropertyInfoTestData;
}

export interface PropertiesTestData {
  property: PropertyTestData;
}

export interface ContentClassInfoTestData {
  name: string;
}

export interface ParentTestData {
  pathToPrimaryClass: RelationshipPath;
  contentClassInfo?: ContentClassInfoTestData;
}

export interface TypeTestData {
  typeName: string;
}

export interface PropertiesFieldTestData {
  properties: PropertiesTestData[];
  type: TypeTestData;
  parent: ParentTestData;
}

export interface PropertyRecordTestData {
  value: PropertyValue;
  property: PropertyDescription;
}

export interface OperationTestData {
  expectedResult?: boolean;
  operationType: string;
  fieldDescriptorType: FieldDescriptorType.Name | FieldDescriptorType.Properties;
  fieldDescriptorName?: string;
  propertyRecord: PropertyRecordTestData;
  propertiesField: PropertiesFieldTestData;
}

export interface TestCase {
  name: string;
  expectedResult: string;
  operations: OperationTestData[];
}

export interface QueryBuilderTestData {
  testCases: TestCase[];
}
