;
/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { expect } from "chai";
import sinon from "sinon";
import { PropertyRecord, PropertyValueFormat } from "@itwin/appui-abstract";
import { KeySet } from "@itwin/presentation-common";
import { PresentationPropertyDataProvider } from "@itwin/presentation-components";
import { useDataProvider } from "../../property-grid-react/hooks/UseDataProvider.js";
import { TelemetryContextProvider } from "../../property-grid-react/hooks/UseTelemetryContext.js";
import { createPropertyRecord, createResolvablePromise, renderHook, stubFavoriteProperties, stubPresentation } from "../TestUtils.js";



import type { PropsWithChildren } from "react";
import type { PropertyData } from "@itwin/components-react";
import type { IModelConnection } from "@itwin/core-frontend";
import type { PerformanceTrackedFeatures } from "../../property-grid-react/hooks/UseTelemetryContext.js";





describe("useDataProvider", () => {
  const imodel = {} as IModelConnection;

  class CustomProvider extends PresentationPropertyDataProvider {}

  before(() => {
    stubFavoriteProperties();
    stubPresentation();
  });

  after(() => {
    sinon.restore();
  });

  it("creates default provider", async () => {
    const { result } = renderHook(useDataProvider, { initialProps: { imodel } });
    expect(result.current).to.not.be.undefined;
  });

  it("creates custom provider", async () => {
    const createDataProvider = sinon.stub().callsFake(() => new CustomProvider({ imodel }));
    const { result } = renderHook(useDataProvider, { initialProps: { imodel, createDataProvider } });
    expect(result.current).to.not.be.undefined;
    expect(createDataProvider).to.be.called;
  });

  describe("performance tracking", () => {
    let getDataStub: sinon.SinonStub<Parameters<PresentationPropertyDataProvider["getData"]>, ReturnType<PresentationPropertyDataProvider["getData"]>>;
    const onPerformanceMeasuredStub = sinon.stub<[PerformanceTrackedFeatures, number], void>();

    function Wrapper({ children }: PropsWithChildren<object>) {
      return <TelemetryContextProvider onPerformanceMeasured={onPerformanceMeasuredStub}>{children}</TelemetryContextProvider>;
    }

    before(() => {
      getDataStub = sinon.stub(PresentationPropertyDataProvider.prototype, "getData");
    });

    beforeEach(() => {
      getDataStub.reset();
      onPerformanceMeasuredStub.reset();
    });

    it("logs performance metrics", async () => {
      const { result } = renderHook(useDataProvider, { initialProps: { imodel }, wrapper: Wrapper });
      expect(result.current).to.not.be.undefined;

      getDataStub.callsFake(async () => {
        return createPropertyData("test-prop", "test-value");
      });
      const provider = result.current!;
      provider.keys = new KeySet([{ id: "0x1", className: "Schema:Class" }]);
      await provider.getData();

      expect(onPerformanceMeasuredStub).to.be.calledOnceWith("properties-load");
    });

    it("logs metrics only for latest request", async () => {
      const { result } = renderHook(useDataProvider, { initialProps: { imodel }, wrapper: Wrapper });
      expect(result.current).to.not.be.undefined;
      const provider = result.current!;

      const firstRequest = createResolvablePromise<PropertyData>();
      getDataStub.callsFake(async () => firstRequest.promise);
      provider.keys = new KeySet([{ id: "0x1", className: "Schema:Class" }]);
      const firstResult = provider.getData();

      const secondRequest = createResolvablePromise<PropertyData>();
      getDataStub.callsFake(async () => secondRequest.promise);
      provider.keys = new KeySet([{ id: "0x2", className: "Schema:Class" }]);
      const secondResult = provider.getData();

      expect(onPerformanceMeasuredStub).to.not.be.called;

      await firstRequest.resolve(createPropertyData("test-prop", "test-value"));
      await firstResult;
      expect(onPerformanceMeasuredStub).to.not.be.called;

      await secondRequest.resolve(createPropertyData("test-prop", "test-value"));
      await secondResult;
      expect(onPerformanceMeasuredStub).to.be.calledOnceWith("properties-load");
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
