/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
import type { PropertyValue } from "@itwin/appui-abstract";
import { PropertyRecord } from "@itwin/appui-abstract";
import { FieldDescriptorType, PropertiesField } from "@itwin/presentation-common";
import type { FieldDescriptor, RelationshipPath, StrippedRelatedClassInfo } from "@itwin/presentation-common";
import { PresentationPropertyDataProvider } from "@itwin/presentation-components";
import { assert } from "chai";
import { QueryBuilder } from "../components/Groups/QueryBuilder/QueryBuilder";
import { MockFactory } from "./MockFactory";
import type { StubbedType } from "./MockFactory";
import type { OperationTestData, PropertiesTestData, PropertyRecordTestData, QueryBuilderTestData } from "./QueryBuilderTestData";
import { testCases } from "./QueryBuilder.testdata";
import type { IModelConnection } from "@itwin/core-frontend";
import type { ECSqlReader } from "@itwin/core-common";

describe("QueryBuilder", () => {
  let sut: QueryBuilder;
  let dataProvider: StubbedType<PresentationPropertyDataProvider>;

  beforeEach(() => {
    dataProvider = MockFactory.create(PresentationPropertyDataProvider);
    MockFactory.stubProperty(dataProvider, "getContentDescriptor", () => () => true);
    const imodel = {
      createQueryReader: (query) => {
        if (query.includes("SELECT ec_classname(ecclassid) FROM biscore.element WHERE ecinstanceid = fakeId")) {
          return {
            next: async () => {
              return {
                value: ["mockModeledElement"],
                done: true,
              };
            },
          } as ECSqlReader;
        }
        return '';
      }
    } as IModelConnection;

    sut = new QueryBuilder(dataProvider, imodel);
  });

  afterEach(() => {
    dataProvider.getFieldByPropertyRecord.restore();
  });

  const testData: QueryBuilderTestData = testCases;
  testData.testCases.forEach((testCase) => {
    it(testCase.name, async () => executeTest(sut, testCase.expectedResult, testCase.operations));
  });

  const createFieldDescriptor = (
    pathToClass: RelationshipPath | undefined,
    fieldProperties: PropertiesTestData[],
    type: FieldDescriptorType,
    fieldName: string | undefined,
  ): FieldDescriptor => {
    switch (type) {
      case FieldDescriptorType.Properties:
        const pathFromSelectToPropertyClass: StrippedRelatedClassInfo[] = (pathToClass ?? []).map((x) => ({
          sourceClassName: x.sourceClassInfo.name,
          targetClassName: x.targetClassInfo.name,
          relationshipName: x.relationshipInfo.name,
          isForwardRelationship: x.isForwardRelationship,
        }));

        const properties = fieldProperties.map((x) => ({
          class: x.property.classInfo.name,
          name: x.property.name,
        }));

        return {
          pathFromSelectToPropertyClass,
          properties,
          type,
        };
      case FieldDescriptorType.Name:
        return {
          type,
          fieldName: fieldName ?? "",
        };
    }
  };

  const createPropertyRecord = (propertyRecord: PropertyRecordTestData, propertiesField: PropertiesField, fieldDescriptor: FieldDescriptor) => {
    const propertiesFieldMock: StubbedType<PropertiesField> = MockFactory.create(PropertiesField);

    MockFactory.stubProperty(propertiesFieldMock, "parent", () => propertiesField.parent);
    MockFactory.stubProperty(propertiesFieldMock, "properties", () => propertiesField.properties);
    MockFactory.stubProperty(propertiesFieldMock, "type", () => propertiesField.type);
    MockFactory.stubProperty(propertiesFieldMock, "getFieldDescriptor", () => () => fieldDescriptor);

    const prop: PropertyRecord = new PropertyRecord(propertyRecord.value as PropertyValue, propertyRecord.property);
    dataProvider.getFieldByPropertyRecord.withArgs(prop).resolves(propertiesFieldMock);
    return prop;
  };

  const executeTest = async (queryBuilder: QueryBuilder, expectedResult: string, operations: OperationTestData[]) => {
    for (const op of operations) {
      const fieldDescriptor = createFieldDescriptor(
        op.propertiesField.parent?.pathToPrimaryClass,
        op.propertiesField.properties,
        op.fieldDescriptorType,
        op.fieldDescriptorName,
      );

      const prop = createPropertyRecord(op.propertyRecord, op.propertiesField as PropertiesField, fieldDescriptor);

      if (op.operationType === "addProperty") {
        const result = await queryBuilder.addProperty(prop);
        assert.strictEqual(result, op.expectedResult);
      }
      if (op.operationType === "removeProperty") {
        await queryBuilder.removeProperty(prop);
      }
    }

    const result = await queryBuilder.buildQueryString();
    assert.strictEqual(result, expectedResult);
  };
});
