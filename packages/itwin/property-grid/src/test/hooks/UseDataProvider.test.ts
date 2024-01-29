/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { expect } from "chai";
import sinon from "sinon";
import { PresentationPropertyDataProvider } from "@itwin/presentation-components";
import { useDataProvider } from "../../property-grid-react";
import { renderHook, stubFavoriteProperties, stubPresentation } from "../TestUtils";

import type { IModelConnection } from "@itwin/core-frontend";

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
    expect(result.current).to.be.instanceOf(PresentationPropertyDataProvider).and.not.be.instanceOf(CustomProvider);
  });

  it("creates custom provider", async () => {
    const { result } = renderHook(useDataProvider, { initialProps: { imodel, createDataProvider: () => new CustomProvider({ imodel }) } });
    expect(result.current).to.be.instanceOf(CustomProvider);
  });
});
