/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { expect } from "chai";
import { PropertyRecord } from "@itwin/appui-abstract";
import { BeEvent } from "@itwin/core-bentley";
import { waitFor } from "@testing-library/react";
import { renderHook } from "@testing-library/react-hooks";
import { useLoadedInstanceInfo } from "../../hooks/UseInstanceInfo";
import { createFunctionStub } from "../TestUtils";

import type { PrimitiveValue } from "@itwin/appui-abstract";
import type { IPresentationPropertyDataProvider, PresentationPropertyDataProvider } from "@itwin/presentation-components";

describe("useInstanceInfo", () => {
  const dataProvider = {
    onDataChanged: new BeEvent(),
    getData: createFunctionStub<PresentationPropertyDataProvider["getData"]>(),
  };

  beforeEach(() => {
    dataProvider.getData.resolves({
      categories: [],
      records: {},
      label: PropertyRecord.fromString("Test Label"),
      description: "TestClassName",
    });
  });

  it("returns label and className", async () => {
    const { result } = renderHook(useLoadedInstanceInfo, { initialProps: { dataProvider: dataProvider as unknown as IPresentationPropertyDataProvider } });
    await waitFor(() => {
      expect(result.current.item?.className).to.be.eq("TestClassName");
      expect((result.current.item?.label.value as PrimitiveValue).value).to.be.eq("Test Label");
    });
  });

  it("returns label and empty className if `propertyData` does not have it", async () => {
    dataProvider.getData.reset();
    dataProvider.getData.resolves({
      categories: [],
      records: {},
      label: PropertyRecord.fromString("Test Label"),
      description: undefined,
    });

    const { result } = renderHook(useLoadedInstanceInfo, { initialProps: { dataProvider: dataProvider as unknown as IPresentationPropertyDataProvider } });
    await waitFor(() => {
      expect((result.current.item?.label.value as PrimitiveValue).value).to.be.eq("Test Label");
      expect(result.current.item?.className).to.be.empty;
    });
  });

  it("returns new label and className when property data changes", async () => {
    const { result } = renderHook(useLoadedInstanceInfo, { initialProps: { dataProvider: dataProvider as unknown as IPresentationPropertyDataProvider } });
    await waitFor(() => {
      expect(result.current.item?.className).to.be.eq("TestClassName");
      expect((result.current.item?.label.value as PrimitiveValue).value).to.be.eq("Test Label");
    });

    dataProvider.getData.reset();
    dataProvider.getData.resolves({
      categories: [],
      records: {},
      label: PropertyRecord.fromString("New Test Label"),
      description: "NewTestClassName",
    });

    dataProvider.onDataChanged.raiseEvent();

    await waitFor(() => {
      expect(result.current.item?.className).to.be.eq("NewTestClassName");
      expect((result.current.item?.label.value as PrimitiveValue).value).to.be.eq("New Test Label");
    });
  });

  it("returns the data of the last event raised, even if the one preceding it ends faster", async () => {
    const { result } = renderHook(useLoadedInstanceInfo, { initialProps: { dataProvider: dataProvider as unknown as IPresentationPropertyDataProvider } });
    await waitFor(() => {
      expect(result.current.item?.className).to.be.eq("TestClassName");
      expect((result.current.item?.label.value as PrimitiveValue).value).to.be.eq("Test Label");
    });

    dataProvider.getData.reset();

    const delay = async (ms: number) =>{
      return new Promise(function (resolve) {
        setTimeout(function () {
          resolve("The sum of all data is 100.");
        }, ms);
      });
    };

    dataProvider.getData.onFirstCall().callsFake(async () => {
      await delay(1000);
      return {
        categories: [],
        records: {},
        label: PropertyRecord.fromString("Old Test Label"),
        description: "OldTestClassName",
      };
    });

    dataProvider.getData.onSecondCall().callsFake(async () => {
      await delay(2000);
      return {
        categories: [],
        records: {},
        label: PropertyRecord.fromString("New Test Label"),
        description: "NewTestClassName",
      };
    });

    dataProvider.onDataChanged.raiseEvent();
    dataProvider.onDataChanged.raiseEvent();

    await waitFor(() => {
      expect(result.current.item?.className).to.be.eq("NewTestClassName");
      expect((result.current.item?.label.value as PrimitiveValue).value).to.be.eq("New Test Label");
    }, { timeout: 3000 });
  });
});
