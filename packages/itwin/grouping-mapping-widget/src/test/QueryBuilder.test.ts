/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { PropertyRecord } from "@itwin/appui-abstract";
import type { PropertyDescription, PropertyValue } from "@itwin/appui-abstract";
import { PropertiesField } from "@itwin/presentation-common";
import { PresentationPropertyDataProvider } from "@itwin/presentation-components";
import { assert } from "chai";
import { QueryBuilder } from "../widget/components/QueryBuilder";
import { MockFactory } from "./MockFactory";
import type { StubbedType } from "./MockFactory";
import testData from "./QueryBuilder.testdata.json";
import type { QueryBuilderTestData } from "./QueryBuilderTestData";

describe("QueryBuilder", () => {
  let sut: QueryBuilder;
  let dataProvider: StubbedType<PresentationPropertyDataProvider>;

  beforeEach(() => {
    dataProvider = MockFactory.create(PresentationPropertyDataProvider);
    MockFactory.stubProperty(dataProvider, "getContentDescriptor", () => () => true);

    sut = new QueryBuilder(dataProvider);
  });

  afterEach(() => {
    dataProvider.getFieldByPropertyRecord.reset();
  });

  const queryBuildertestData: QueryBuilderTestData = testData;
  queryBuildertestData.testCases.forEach((testCase) => {
    it(testCase.name, async () => executeTest(
      sut,
      testCase.expectedResult,
      testCase.operations,
    ));
  });

  const mockPropertiesField = (propertyRecord: PropertyRecord, propertiesField: PropertiesField) => {
    const propertiesFieldMock: StubbedType<PropertiesField> = MockFactory.create(PropertiesField);

    MockFactory.stubProperty(propertiesFieldMock, "parent", () => propertiesField.parent);
    MockFactory.stubProperty(propertiesFieldMock, "properties", () => propertiesField.properties);
    MockFactory.stubProperty(propertiesFieldMock, "type", () => propertiesField.type);

    dataProvider.getFieldByPropertyRecord.withArgs(propertyRecord).returns(Promise.resolve(propertiesFieldMock));
  };

  const executeTest = async (queryBuilder: QueryBuilder, expectedResult: string, operations: any[]) => {
    for (const op of operations) {
      const prop: PropertyRecord = new PropertyRecord(op.propertyRecord.value as PropertyValue, op.propertyRecord.property as PropertyDescription);

      mockPropertiesField(prop, op.propertiesField);

      if (op.operationType === "addProperty") {
        const result = await queryBuilder.addProperty(prop);
        assert.strictEqual(result, op.expectedResult);
      }
      if (op.operationType === "removeProperty") {
        await queryBuilder.removeProperty(prop);
      }
    }

    const result = queryBuilder.buildQueryString();
    assert.strictEqual(result, expectedResult);
  };
});
