/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
/* eslint-disable deprecation/deprecation */
/* eslint-disable @itwin/no-internal */

import { expect, should } from "chai";
import * as sinon from "sinon";
import {
  BackgroundMapProvider,
  BackgroundMapType,
  BaseLayerSettings,
  BaseMapLayerSettings,
  ColorByName,
  ColorDef,
  MapImagerySettings,
} from "@itwin/core-common";
import { MockRender } from "@itwin/core-frontend";
import { findByTestId, fireEvent, getByTestId, render } from "@testing-library/react";
import { BasemapPanel } from "../ui/widget/BasemapPanel";
import { defaultBaseMapLayers, SourceMapContext } from "../ui/widget/MapLayerManager";
import { TestUtils } from "./TestUtils";
import { ViewportMock } from "./ViewportMock";

describe("BasemapPanel", () => {
  const sandbox = sinon.createSandbox();
  const viewportMock = new ViewportMock();

  const customBaseMap: BaseMapLayerSettings = BaseMapLayerSettings.fromJSON({
    formatId: "WMS",
    name: "Custom Layer",
    visible: true,
    transparentBackground: true,
    subLayers: [{ name: "subLayer1", visible: false }],
    accessKey: undefined,
    transparency: 0,
    url: "https://server/MapServer",
  });

  before(async () => {
    await MockRender.App.startup();
    await TestUtils.initialize();
    window.HTMLElement.prototype.scrollIntoView = function () {};
  });

  after(async () => {
    await MockRender.App.shutdown();
    TestUtils.terminateUiComponents();
  });

  afterEach(() => {
    sandbox.restore();
    viewportMock.reset();
  });

  beforeEach(() => {
    viewportMock.setup();
  });

  it("renders base maps", async () => {
    const { container } = render(
      <SourceMapContext.Provider
        value={{
          activeViewport: viewportMock.object,
          loadingSources: false,
          sources: [],
          bases: defaultBaseMapLayers,
          refreshFromStyle: () => {},
        }}
      >
        <BasemapPanel />
      </SourceMapContext.Provider>,
    );
    await TestUtils.flushAsyncOperations();
    const iconVisibility = getByTestId(container, "toggle-visibility");
    //  container.querySelector(".icon-visibility");
    should().exist(iconVisibility);

    const selectContent = getByTestId(container, "base-map-select") as HTMLElement;
    should().exist(selectContent);
    expect(selectContent.textContent).to.eql("WellKnownBaseMaps.BingProvider.Hybrid");
  });

  // TODO: Re-enable this once moved off of enzyme and @testing-library/react-hooks. This is failing with no consistent returns values, highlighting async issues.
  it.skip("should refresh select content after API call", async () => {
    const { container } = render(
      <SourceMapContext.Provider
        value={{
          activeViewport: viewportMock.object,
          loadingSources: false,
          sources: [],
          bases: defaultBaseMapLayers,
          refreshFromStyle: () => {},
        }}
      >
        <BasemapPanel />
      </SourceMapContext.Provider>,
    );

    // let baseMap = BaseMapLayerSettings.fromProvider(BackgroundMapProvider.fromJSON({name: "BingProvider", type: BackgroundMapType.Street}));
    let baseMap: BaseLayerSettings = defaultBaseMapLayers[2];
    viewportMock.baseMap = baseMap;
    viewportMock.onMapImageryChanged.raiseEvent(MapImagerySettings.fromJSON({ backgroundBase: baseMap }));
    await TestUtils.flushAsyncOperations();

    let selectContent = getByTestId(container, "base-map-select");
    should().exist(selectContent);
    expect(selectContent!.textContent).to.eql("WellKnownBaseMaps.BingProvider.Street");

    // Now test with a custom map-layer definition
    baseMap = customBaseMap;
    viewportMock.baseMap = baseMap;
    viewportMock.onMapImageryChanged.raiseEvent(MapImagerySettings.fromJSON({ backgroundBase: baseMap }));
    await TestUtils.flushAsyncOperations();

    selectContent = getByTestId(container, "base-map-select");
    should().exist(selectContent);
    expect(selectContent!.textContent).to.eql(customBaseMap.name);

    // Now test with a ColorDef
    const color = ColorDef.create(ColorByName.aliceBlue);
    viewportMock.baseMap = color;
    viewportMock.onMapImageryChanged.raiseEvent(MapImagerySettings.fromJSON({ backgroundBase: color.toJSON() }));
    await TestUtils.flushAsyncOperations();

    selectContent = getByTestId(container, "base-map-select");
    should().exist(selectContent);
    expect(selectContent!.textContent).to.eql("Basemap.ColorFill");
  });

  it("should refresh transparency slider and visibility icon after API call", async () => {
    const { container } = render(
      <SourceMapContext.Provider
        value={{
          activeViewport: viewportMock.object,
          loadingSources: false,
          sources: [],
          bases: defaultBaseMapLayers,
          refreshFromStyle: () => {},
        }}
      >
        <BasemapPanel />
      </SourceMapContext.Provider>,
    );

    const baseMap = BaseMapLayerSettings.fromProvider(
      BackgroundMapProvider.fromJSON({ name: "BingProvider", type: BackgroundMapType.Street }),
      { invisible: true, transparency: 0.5 },
    );
    viewportMock.baseMap = baseMap; // mock needs to be updated too because the component refresh from the viewport too .
    viewportMock.onMapImageryChanged.raiseEvent(MapImagerySettings.fromJSON({ backgroundBase: baseMap }));
    await TestUtils.flushAsyncOperations();

    const iconVisibilityHide = await findByTestId(container, "layer-visibility-icon-hide");
    should().exist(iconVisibilityHide);

    // check transparency slider has been updated
    const transparencyButton = container.querySelector(".map-transparency-popup-button") as HTMLElement;
    should().exist(transparencyButton);
    fireEvent.click(transparencyButton);
    const sliderThumb = document.querySelector('div[role="slider"]');
    expect(sliderThumb?.getAttribute("aria-valuenow")).to.eql((baseMap.transparency * 100).toString());
  });
});
