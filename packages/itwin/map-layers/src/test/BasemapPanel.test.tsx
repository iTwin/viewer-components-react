/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/* eslint-disable deprecation/deprecation */

import { expect, should } from "chai";
import * as React from "react";
import * as sinon from "sinon";
import * as coreCommon from "@itwin/core-common";
import * as coreFrontend from "@itwin/core-frontend";
import { fireEvent, render } from "@testing-library/react";
import { SourceMapContext } from "../ui/widget/MapLayerManager";
import { TestUtils } from "./TestUtils";
import { ViewportMock } from "./ViewportMock";
import { BasemapPanel } from "../ui/widget/BasemapPanel";

describe("BasemapPanel", () => {
  const sandbox = sinon.createSandbox();
  const viewportMock = new ViewportMock();

  before(async () => {
    await coreFrontend.MockRender.App.startup();
    await TestUtils.initialize();
    window.HTMLElement.prototype.scrollIntoView = function () {};
  });

  after(async () => {
    await coreFrontend.MockRender.App.shutdown();
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
    const mls = await coreFrontend.MapLayerSources.create();

    const bases = mls?.bases;
    const { container } = render( <SourceMapContext.Provider value={{
      activeViewport: viewportMock.object,
      loadingSources: false,
      sources: [],
      bases,
      refreshFromStyle: ()=>{},
    }}>
      <BasemapPanel />
    </SourceMapContext.Provider>);
    await TestUtils.flushAsyncOperations();

    const iconVisibility = container.querySelector(".icon-visibility");
    should().exist(iconVisibility);

    const selectContent = container.querySelector(".iui-content") as HTMLElement;
    should().exist(selectContent);
    expect(selectContent.textContent).to.eql("Bing Maps: Aerial Imagery with labels");
  });

  it("should refresh select content after API call", async () => {
    const mls = await coreFrontend.MapLayerSources.create();

    const bases = mls?.bases;
    const { container } = render( <SourceMapContext.Provider value={{
      activeViewport: viewportMock.object,
      loadingSources: false,
      sources: [],
      bases,
      refreshFromStyle: ()=>{},
    }}>
      <BasemapPanel />
    </SourceMapContext.Provider>);

    const baseMap = coreCommon.BaseMapLayerSettings.fromProvider(coreCommon.BackgroundMapProvider.fromJSON({name: "BingProvider", type: coreCommon.BackgroundMapType.Street}));
    viewportMock.baseMap = baseMap;
    viewportMock.onMapImageryChanged.raiseEvent(coreCommon.MapImagerySettings.fromJSON({backgroundBase: baseMap}));
    await TestUtils.flushAsyncOperations();

    const selectContent = container.querySelector(".iui-content");
    should().exist(selectContent);
    expect(selectContent!.textContent).to.eql("Bing Maps: Streets");
  });

  it("should refresh transparency slider and visibility icon after API call", async () => {
    const mls = await coreFrontend.MapLayerSources.create();

    const bases = mls?.bases;
    const { container } = render( <SourceMapContext.Provider value={{
      activeViewport: viewportMock.object,
      loadingSources: false,
      sources: [],
      bases,
      refreshFromStyle: ()=>{},
    }}>
      <BasemapPanel />
    </SourceMapContext.Provider>);

    const baseMap = coreCommon.BaseMapLayerSettings.fromProvider(coreCommon.BackgroundMapProvider.fromJSON({name: "BingProvider", type: coreCommon.BackgroundMapType.Street}), {invisible: true, transparency: 0.5});
    viewportMock.baseMap = baseMap;   // mock needs to be updated too because the component refresh from the viewport too.
    viewportMock.onMapImageryChanged.raiseEvent(coreCommon.MapImagerySettings.fromJSON({backgroundBase: baseMap}));
    await TestUtils.flushAsyncOperations();

    const iconVisibilityHide = container.querySelector(".icon-visibility-hide-2");
    should().exist(iconVisibilityHide);

    // check transparency slider has been updated
    const transparencyButton = container.querySelector(".map-transparency-popup-button") as HTMLElement;
    should().exist(transparencyButton);
    fireEvent.click(transparencyButton);
    const sliderThumb = document.querySelector(".iui-slider-thumb");
    expect(sliderThumb?.getAttribute("aria-valuenow")).to.eql((baseMap.transparency*100).toString());

  });
});
