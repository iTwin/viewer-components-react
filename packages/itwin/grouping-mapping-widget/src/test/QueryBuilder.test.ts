/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { PropertyRecord } from "@itwin/appui-abstract";
import { PropertiesField } from "@itwin/presentation-common";
import { PresentationPropertyDataProvider } from "@itwin/presentation-components";
import { assert } from "chai";
import { QueryBuilder } from "../widget/components/QueryBuilder";
import { MockFactory } from "./MockFactory";
import type { StubbedType } from "./MockFactory";
import type { OperationTestData, PropertyRecordTestData, QueryBuilderTestData } from "./QueryBuilderTestData";
import { testCases } from "./QueryBuilder.testdata";

describe("QueryBuilder", () => {
  let sut: QueryBuilder;
  let dataProvider: StubbedType<PresentationPropertyDataProvider>;

  beforeEach(() => {
    dataProvider = MockFactory.create(PresentationPropertyDataProvider);
    MockFactory.stubProperty(dataProvider, "getContentDescriptor", () => () => true);

    sut = new QueryBuilder(dataProvider);
  });

  afterEach(() => {
    dataProvider.getFieldByPropertyRecord.restore();
  });

  const testData: QueryBuilderTestData = testCases;
  testData.testCases.forEach((testCase) => {
    it(testCase.name, async () => executeTest(
      sut,
      testCase.expectedResult,
      testCase.operations,
    ));
  });

  const createPropertyRecord = (propertyRecord: PropertyRecordTestData, propertiesField: PropertiesField) => {
    const propertiesFieldMock: StubbedType<PropertiesField> = MockFactory.create(PropertiesField);

    MockFactory.stubProperty(propertiesFieldMock, "parent", () => propertiesField.parent);
    MockFactory.stubProperty(propertiesFieldMock, "properties", () => propertiesField.properties);
    MockFactory.stubProperty(propertiesFieldMock, "type", () => propertiesField.type);

    const prop: PropertyRecord = new PropertyRecord(propertyRecord.value, propertyRecord.property);
    dataProvider.getFieldByPropertyRecord.withArgs(prop).resolves(propertiesFieldMock);
    return prop;
  };

  const executeTest = async (queryBuilder: QueryBuilder, expectedResult: string, operations: OperationTestData[]) => {
    for (const op of operations) {
      const prop = createPropertyRecord(op.propertyRecord, op.propertiesField as PropertiesField);

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
