/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { beforeEach, describe, expect, it, vi } from "vitest";
import { PropertyRecord, PropertyValueFormat } from "@itwin/appui-abstract";
import { KeySet } from "@itwin/presentation-common";
import { PresentationPropertyDataProvider } from "@itwin/presentation-components";
import { useDataProvider } from "../../property-grid-react/hooks/UseDataProvider.js";
import { TelemetryContextProvider } from "../../property-grid-react/hooks/UseTelemetryContext.js";
import { createPropertyRecord, createResolvablePromise, renderHook, stubFavoriteProperties, stubPresentation } from "../TestUtils.js";

import type { PropsWithChildren } from "react";
import type { MockInstance } from "vitest";
import type { PropertyData } from "@itwin/components-react";
import type { IModelConnection } from "@itwin/core-frontend";

describe("useDataProvider", () => {
  const imodel = {} as IModelConnection;

  class CustomProvider extends PresentationPropertyDataProvider {}

  beforeEach(() => {
    stubFavoriteProperties();
    stubPresentation();
  });

  it("creates default provider", async () => {
    const { result } = renderHook(useDataProvider, { initialProps: { imodel } });
    expect(result.current).toBeDefined();
  });

  it("creates custom provider", async () => {
    const createDataProvider = vi.fn().mockImplementation(() => new CustomProvider({ imodel }));
    const { result } = renderHook(useDataProvider, { initialProps: { imodel, createDataProvider } });
    expect(result.current).toBeDefined();
    expect(createDataProvider).toHaveBeenCalled();
  });

  describe("performance tracking", () => {
    let getDataStub: MockInstance<() => Promise<PropertyData>>;
    const onPerformanceMeasuredStub = vi.fn();

    function Wrapper({ children }: PropsWithChildren<object>) {
      return <TelemetryContextProvider onPerformanceMeasured={onPerformanceMeasuredStub}>{children}</TelemetryContextProvider>;
    }

    beforeEach(() => {
      getDataStub = vi.spyOn(PresentationPropertyDataProvider.prototype, "getData");
      onPerformanceMeasuredStub.mockReset();
    });

    it("logs performance metrics", async () => {
      const { result } = renderHook(useDataProvider, { initialProps: { imodel }, wrapper: Wrapper });
      expect(result.current).toBeDefined();

      getDataStub.mockImplementation(async () => {
        return createPropertyData("test-prop", "test-value");
      });
      const provider = result.current!;
      provider.keys = new KeySet([{ id: "0x1", className: "Schema:Class" }]);
      await provider.getData();

      expect(onPerformanceMeasuredStub).toHaveBeenCalledExactlyOnceWith("properties-load", expect.any(Number));
    });

    it("logs metrics only for latest request", async () => {
      const { result } = renderHook(useDataProvider, { initialProps: { imodel }, wrapper: Wrapper });
      expect(result.current).toBeDefined();
      const provider = result.current!;

      const firstRequest = createResolvablePromise<PropertyData>();
      getDataStub.mockImplementation(async () => firstRequest.promise);
      provider.keys = new KeySet([{ id: "0x1", className: "Schema:Class" }]);
      const firstResult = provider.getData();

      const secondRequest = createResolvablePromise<PropertyData>();
      getDataStub.mockImplementation(async () => secondRequest.promise);
      provider.keys = new KeySet([{ id: "0x2", className: "Schema:Class" }]);
      const secondResult = provider.getData();

      expect(onPerformanceMeasuredStub).not.toHaveBeenCalled();

      await firstRequest.resolve(createPropertyData("test-prop", "test-value"));
      await firstResult;
      expect(onPerformanceMeasuredStub).not.toHaveBeenCalled();

      await secondRequest.resolve(createPropertyData("test-prop", "test-value"));
      await secondResult;
      expect(onPerformanceMeasuredStub).toHaveBeenCalledExactlyOnceWith("properties-load", expect.any(Number));
    });
  });
});

function createPropertyData(propName: string, propValue: string): PropertyData {
  return {
    categories: [{ expand: true, label: "Test Category", name: "test-category" }],
    label: PropertyRecord.fromString("Test Instance"),
    records: {
      ["test-category"]: [
        createPropertyRecord(
          { valueFormat: PropertyValueFormat.Primitive, value: propValue, displayValue: propValue },
          { name: propName, displayLabel: propName },
        ),
      ],
    },
  };
}
