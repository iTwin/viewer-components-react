/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import type { RelationshipPath } from "@itwin/presentation-common";

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

export interface PropertyRecordValueTestData {
  valueFormat: number;
  value: string | number;
}

export interface PropertyRecordPropertyTestData {
  typename: string;
}

export interface PropertyRecordTestData {
  value: PropertyRecordValueTestData;
  property: PropertyRecordPropertyTestData;
}

export interface OperationTestData {
  expectedResult?: boolean;
  operationType: string;
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
