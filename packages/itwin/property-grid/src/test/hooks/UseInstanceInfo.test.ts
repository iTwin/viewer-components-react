/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { beforeEach, describe, expect, it } from "vitest";
import { PropertyRecord } from "@itwin/appui-abstract";
import { BeEvent } from "@itwin/core-bentley";
import { useLoadedInstanceInfo } from "../../property-grid-react/hooks/UseInstanceInfo.js";
import { act, createFunctionStub, createResolvablePromise, renderHook, waitFor } from "../TestUtils.js";

import type { PrimitiveValue } from "@itwin/appui-abstract";
import type { PropertyData } from "@itwin/components-react";
import type { IPresentationPropertyDataProvider, PresentationPropertyDataProvider } from "@itwin/presentation-components";

describe("useInstanceInfo", () => {
  const dataProvider = {
    onDataChanged: new BeEvent(),
    getData: createFunctionStub<PresentationPropertyDataProvider["getData"]>(),
  };

  beforeEach(() => {
    dataProvider.getData.mockResolvedValue({
      categories: [],
      records: {},
      label: PropertyRecord.fromString("Test Label"),
      description: "TestClassName",
    });
  });

  it("returns label and className", async () => {
    const { result } = renderHook(useLoadedInstanceInfo, { initialProps: { dataProvider: dataProvider as unknown as IPresentationPropertyDataProvider } });
    await waitFor(() => {
      expect(result.current.item?.className).toBe("TestClassName");
      expect((result.current.item?.label.value as PrimitiveValue).value).toBe("Test Label");
    });
  });

  it("returns label and empty className if `propertyData` does not have it", async () => {
    dataProvider.getData.mockReset();
    dataProvider.getData.mockResolvedValue({
      categories: [],
      records: {},
      label: PropertyRecord.fromString("Test Label"),
      description: undefined,
    });

    const { result } = renderHook(useLoadedInstanceInfo, { initialProps: { dataProvider: dataProvider as unknown as IPresentationPropertyDataProvider } });
    await waitFor(() => {
      expect((result.current.item?.label.value as PrimitiveValue).value).toBe("Test Label");
      expect(result.current.item?.className).toHaveLength(0);
    });
  });

  it("returns new label and className when property data changes", async () => {
    const { result } = renderHook(useLoadedInstanceInfo, { initialProps: { dataProvider: dataProvider as unknown as IPresentationPropertyDataProvider } });
    await waitFor(() => {
      expect(result.current.item?.className).toBe("TestClassName");
      expect((result.current.item?.label.value as PrimitiveValue).value).toBe("Test Label");
    });

    dataProvider.getData.mockReset();
    dataProvider.getData.mockResolvedValue({
      categories: [],
      records: {},
      label: PropertyRecord.fromString("New Test Label"),
      description: "NewTestClassName",
    });

    dataProvider.onDataChanged.raiseEvent();

    await waitFor(() => {
      expect(result.current.item?.className).toBe("NewTestClassName");
      expect((result.current.item?.label.value as PrimitiveValue).value).toBe("New Test Label");
    });
  });

  it("returns the data of the last event raised, even if the one preceding it completes later", async () => {
    const { result } = renderHook(useLoadedInstanceInfo, { initialProps: { dataProvider: dataProvider as unknown as IPresentationPropertyDataProvider } });
    await waitFor(() => {
      expect(result.current.item?.className).toBe("TestClassName");
      expect((result.current.item?.label.value as PrimitiveValue).value).toBe("Test Label");
    });

    const firstGetDataPromise = createResolvablePromise<PropertyData>();
    const secondGetDataPromise = createResolvablePromise<PropertyData>();

    dataProvider.getData.mockReset();

    dataProvider.getData.mockReturnValueOnce(firstGetDataPromise.promise);
    dataProvider.getData.mockReturnValueOnce(secondGetDataPromise.promise);

    act(() => dataProvider.onDataChanged.raiseEvent());
    act(() => dataProvider.onDataChanged.raiseEvent());

    await act(async () =>
      secondGetDataPromise.resolve({
        categories: [],
        records: {},
        label: PropertyRecord.fromString("New Test Label"),
        description: "NewTestClassName",
      }),
    );

    await act(async () =>
      firstGetDataPromise.resolve({
        categories: [],
        records: {},
        label: PropertyRecord.fromString("Old Test Label"),
        description: "OldTestClassName",
      }),
    );

    await waitFor(() => {
      expect(result.current.item?.className).toBe("NewTestClassName");
      expect((result.current.item?.label.value as PrimitiveValue).value).toBe("New Test Label");
    });
  });
});
