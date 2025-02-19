/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
/* eslint-disable deprecation/deprecation */

import { assert, expect, should } from "chai";
import * as enzyme from "enzyme";
import * as sinon from "sinon";
import * as moq from "typemoq";
import { PlanarClipMaskMode, PlanarClipMaskPriority, TerrainHeightOriginMode } from "@itwin/core-common";
import { MockRender } from "@itwin/core-frontend";
import { QuantityNumberInput } from "@itwin/imodel-components-react";
import { Input, Select, ToggleSwitch } from "@itwin/itwinui-react";
import { act, fireEvent, render } from "@testing-library/react";
import { SourceMapContext } from "../ui/widget/MapLayerManager";
import { MapManagerSettings } from "../ui/widget/MapManagerSettings";
import { TestUtils } from "./TestUtils";

import type { ChangeEvent } from "react";
import type { SelectValueChangeEvent } from "@itwin/itwinui-react";
import type { BackgroundMapSettings, DisplayStyle3dSettings, TerrainSettings } from "@itwin/core-common";
import type { DisplayStyle3dState, IModelConnection, ScreenViewport, ViewState3d } from "@itwin/core-frontend";
describe("MapManagerSettings", () => {
  const viewportMock = moq.Mock.ofType<ScreenViewport>();
  const viewMock = moq.Mock.ofType<ViewState3d>();
  const displayStyleMock = moq.Mock.ofType<DisplayStyle3dState>();
  const imodelMock = moq.Mock.ofType<IModelConnection>();
  const displayStyleSettingsMock = moq.Mock.ofType<DisplayStyle3dSettings>();
  const backgroundMapSettingsMock = moq.Mock.ofType<BackgroundMapSettings>();
  const terrainSettingsMock = moq.Mock.ofType<TerrainSettings>();

  // Utility methods that give the index of components rendered by
  // MapManagerSettings.
  // Any re-ordering inside the component render will invalidate
  // this and will need to be revisited.
  const getToggleIndex = (toggleName: string) => {
    switch (toggleName) {
      case "locatable":
        return 0;
      case "mask":
        return 1;
      case "overrideMaskTransparency":
        return 2;
      case "depthBuffer":
        return 3;
      case "terrain":
        return 4;
    }
    assert.fail("invalid name provided.");
  };

  const getQuantityNumericInputIndex = (name: string) => {
    switch (name) {
      case "groundBias":
        return 0;
      case "terrainOrigin":
        return 1;
    }
    assert.fail("invalid name provided.");
  };

  const changeNumericInputValue = (component: any, value: number) => {
    // For some reasons could not get 'simulate' and 'change' to work here, so calling directly the onChange prop instead.
    component.find("input").props().onChange!({ currentTarget: { value } } as any);

    // Handler is not triggered until there is a key press
    component.find("input").simulate("keydown", { key: "Enter" });
    component.update();
  };

  before(async () => {
    await MockRender.App.startup();
    await TestUtils.initialize();
  });

  after(async () => {
    await MockRender.App.shutdown();
    TestUtils.terminateUiComponents();
  });

  beforeEach(() => {
    window.HTMLElement.prototype.scrollTo = () => {};
    terrainSettingsMock.reset();
    terrainSettingsMock.setup((ts) => ts.heightOriginMode).returns(() => TerrainHeightOriginMode.Geodetic);
    terrainSettingsMock.setup((ts) => ts.heightOrigin).returns(() => 0);
    terrainSettingsMock.setup((ts) => ts.exaggeration).returns(() => 0);
    backgroundMapSettingsMock.reset();
    backgroundMapSettingsMock.setup((bgMapSettings) => bgMapSettings.groundBias).returns(() => 0);
    backgroundMapSettingsMock.setup((bgMapSettings) => bgMapSettings.transparency).returns(() => 0);
    backgroundMapSettingsMock.setup((bgMapSettings) => bgMapSettings.applyTerrain).returns(() => false);
    backgroundMapSettingsMock.setup((bgMapSettings) => bgMapSettings.terrainSettings).returns(() => terrainSettingsMock.object);
    backgroundMapSettingsMock.setup((bgMapSettings) => bgMapSettings.useDepthBuffer).returns(() => false);
    backgroundMapSettingsMock.setup((bgMapSettings) => bgMapSettings.locatable).returns(() => true);
    displayStyleSettingsMock.reset();
    displayStyleSettingsMock.setup((styleSettings) => styleSettings.backgroundMap).returns(() => backgroundMapSettingsMock.object);
    displayStyleMock.reset();
    displayStyleMock.setup((ds) => ds.attachMapLayer(moq.It.isAny()));
    displayStyleMock.setup((style) => style.attachMapLayer(moq.It.isAny()));
    displayStyleMock.setup((style) => style.settings).returns(() => displayStyleSettingsMock.object);
    viewMock.reset();
    viewMock.setup((view) => view.iModel).returns(() => imodelMock.object);
    viewMock.setup((x) => x.getDisplayStyle3d()).returns(() => displayStyleMock.object);

    viewportMock.reset();
    viewportMock.setup((viewport) => viewport.view).returns(() => viewMock.object);
    viewportMock.setup((viewport) => viewport.changeBackgroundMapProps(moq.It.isAny()));
  });
  const refreshFromStyle = sinon.spy();

  const mountComponent = () => {
    return enzyme.mount(
      <SourceMapContext.Provider
        value={{
          activeViewport: viewportMock.object,
          loadingSources: false,
          sources: [],
          bases: [],
          refreshFromStyle,
        }}
      >
        <MapManagerSettings />
      </SourceMapContext.Provider>,
    );
  };

  it("renders", () => {
    const wrapper = mountComponent();
    wrapper.unmount();
  });

  it("Terrain toggle", () => {
    const component = mountComponent();

    const quantityNumericInputs = component.find(QuantityNumberInput);

    // Make sure groundBias is NOT disabled
    // Note: Ideally I would use a CSS selector instead of searching html, but could not find any that would work.
    expect(quantityNumericInputs.at(getQuantityNumericInputIndex("groundBias")).find("input").html().includes("disabled")).to.be.false;

    // terrainOrigin is disabled initially
    expect(quantityNumericInputs.at(getQuantityNumericInputIndex("terrainOrigin")).find("input").html().includes("disabled")).to.be.true;

    // exaggeration is disabled initially
    const exaggerationInput = component.find(Input).filterWhere((input) =>input.props()["data-testid"] === "exaggeration-input");
    expect(exaggerationInput.props().disabled).to.be.true;

    // Make sure the 'useDepthBuffer' toggle is NOT disabled
    let toggles = component.find(ToggleSwitch);

    // Elevation type should be disabled initially
    let select = component.find(Select);
    expect(select.props().disabled).to.be.true;

    expect(toggles.at(getToggleIndex("depthBuffer")).find(".iui-disabled").exists()).to.be.false;

    // 'changeBackgroundMapProps' should not have been called before terrain is toggled
    viewportMock.verify((x) => x.changeBackgroundMapProps(moq.It.isAny()), moq.Times.never());

    // Toggle 'enable' terrain
    toggles
      .at(getToggleIndex("terrain"))
      .find("input")
      .simulate("change", { target: { checked: true } });
    component.update();

    // 'changeBackgroundMapProps' should have been called once now
    viewportMock.verify((x) => x.changeBackgroundMapProps(moq.It.isAny()), moq.Times.once());

    // 'useDepthBuffer' toggle should now be disabled
    toggles = component.find(ToggleSwitch);
    expect(toggles.at(getToggleIndex("depthBuffer")).find(".iui-disabled").exists()).to.be.true;

    const quantityInputs = component.find(QuantityNumberInput);
    // Make sure groundBias is now disabled
    expect(quantityInputs.at(getQuantityNumericInputIndex("groundBias")).find("input").html().includes("disabled")).to.be.true;

    // terrainOrigin and exaggeration should be enable after terrain was toggled
    expect(quantityInputs.at(getQuantityNumericInputIndex("terrainOrigin")).find("input").html().includes("disabled")).to.be.false;

    // terrainOrigin and exaggeration should be enable after terrain was toggled
    const exaggerationInputAfter = component.find(Input).filterWhere((input) =>input.props()["data-testid"] === "exaggeration-input");
    expect(exaggerationInputAfter.props().disabled).to.be.false;

    // Elevation type should be enabled
    select = component.find(Select);
    expect(select.props().disabled).to.be.false;
    component.unmount();
  });

  // Disabled slider testing until we find a reliable way to 'move' the slider
  it("Transparency slider", () => {
    viewportMock.verify((x) => x.changeBackgroundMapProps(moq.It.isAny()), moq.Times.never());

    const { container } = render(
      <SourceMapContext.Provider
        value={{
          activeViewport: viewportMock.object,
          loadingSources: false,
          sources: [],
          bases: [],
          refreshFromStyle,
        }}
      >
        <MapManagerSettings />
      </SourceMapContext.Provider>,
    );

    const sliders = container.querySelectorAll('div[role="slider"]');
    expect(sliders.length).to.eq(2);
    act(() => {
      fireEvent.keyUp(sliders[0], { key: "ArrowLeft" });
    });
    viewportMock.verify((x) => x.changeBackgroundMapProps({ transparency: 0 }), moq.Times.once());
  });

  it("Mask Transparency slider", () => {
    viewportMock.verify((x) => x.changeBackgroundMapProps(moq.It.isAny()), moq.Times.never());
    const { container } = render(
      <SourceMapContext.Provider
        value={{
          activeViewport: viewportMock.object,
          loadingSources: false,
          sources: [],
          bases: [],
          refreshFromStyle,
        }}
      >
        <MapManagerSettings />
      </SourceMapContext.Provider>,
    );

    const sliders = container.querySelectorAll('div[role="slider"]');
    expect(sliders.length).to.eq(2);

    const sliderThumb = sliders[1];

    // Make sure the slider is disabled by default
    expect(sliderThumb?.getAttribute("aria-disabled")).to.eql("true");

    // Turn on the mask toggle
    const toggles = container.querySelectorAll('input[role="switch"]');
    const maskToggle = toggles[getToggleIndex("mask")];
    should().exist(maskToggle);
    fireEvent.click(maskToggle);
    // Enabling the 'mask' toggle should set mask transparency to undefined
    viewportMock.verify(
      (x) =>
        x.changeBackgroundMapProps({
          planarClipMask: { mode: PlanarClipMaskMode.Priority, priority: PlanarClipMaskPriority.BackgroundMap, transparency: undefined },
        }),
      moq.Times.once(),
    );

    const overrideMaskTransToggle = toggles[getToggleIndex("overrideMaskTransparency")];
    should().exist(overrideMaskTransToggle);
    fireEvent.click(overrideMaskTransToggle);

    // Enabling the 'overrideMaskTransparency' toggle should set mask transparency to 0
    viewportMock.verify(
      (x) =>
        x.changeBackgroundMapProps({ planarClipMask: { mode: PlanarClipMaskMode.Priority, priority: PlanarClipMaskPriority.BackgroundMap, transparency: 0 } }),
      moq.Times.once(),
    );

    expect(sliderThumb?.getAttribute("aria-disabled")).to.eql("false");

    // Make sure the slider event are handled
    act(() => {
      fireEvent.keyUp(sliderThumb, { key: "ArrowLeft" });
    });
    viewportMock.verify(
      (x) =>
        x.changeBackgroundMapProps({ planarClipMask: { mode: PlanarClipMaskMode.Priority, priority: PlanarClipMaskPriority.BackgroundMap, transparency: 0 } }),
      moq.Times.exactly(2),
    );
  });

  it("Locatable toggle", () => {
    const component = mountComponent();
    const toggles = component.find(ToggleSwitch);

    viewportMock.verify((x) => x.changeBackgroundMapProps(moq.It.isAny()), moq.Times.never());
    toggles
      .at(getToggleIndex("locatable"))
      .find("input")
      .simulate("change", { target: { checked: false } });
    component.update();

    // 'changeBackgroundMapProps' should have been called once now
    viewportMock.verify((x) => x.changeBackgroundMapProps({ nonLocatable: true }), moq.Times.once());
    component.unmount();
  });

  it("Mask toggle", () => {
    const component = mountComponent();

    const toggles = component.find(ToggleSwitch);

    viewportMock.verify((x) => x.changeBackgroundMapProps(moq.It.isAny()), moq.Times.never());
    toggles
      .at(getToggleIndex("mask"))
      .find("input")
      .simulate("change", { target: { checked: true } });
    component.update();

    // 'changeBackgroundMapProps' should have been called once now
    viewportMock.verify(
      (x) =>
        x.changeBackgroundMapProps({
          planarClipMask: { mode: PlanarClipMaskMode.Priority, priority: PlanarClipMaskPriority.BackgroundMap, transparency: undefined },
        }),
      moq.Times.once(),
    );

    toggles
      .at(getToggleIndex("mask"))
      .find("input")
      .simulate("change", { target: { checked: false } });
    component.update();

    viewportMock.verify((x) => x.changeBackgroundMapProps({ planarClipMask: { mode: PlanarClipMaskMode.None } }), moq.Times.once());
    component.unmount();
  });

  it("Override Mask Transparency Toggle", () => {
    viewportMock.verify((x) => x.changeBackgroundMapProps(moq.It.isAny()), moq.Times.never());
    const component = mountComponent();

    let toggles = component.find(ToggleSwitch);

    // By default, the toggle should be disabled
    expect(toggles.at(getToggleIndex("overrideMaskTransparency")).find(".iui-disabled").exists()).to.be.true;

    // First turn ON the masking toggle
    toggles
      .at(getToggleIndex("mask"))
      .find("input")
      .simulate("change", { target: { checked: true } });
    component.update();

    toggles = component.find(ToggleSwitch);

    // Toggle should be enabled now
    expect(toggles.at(getToggleIndex("overrideMaskTransparency")).find(".iui-disabled").exists()).to.be.false;

    // .. then we can turn ON the override mask transparency
    toggles
      .at(getToggleIndex("overrideMaskTransparency"))
      .find("input")
      .simulate("change", { target: { checked: true } });
    component.update();

    // 'changeBackgroundMapProps' should have been called once now
    viewportMock.verify(
      (x) =>
        x.changeBackgroundMapProps({ planarClipMask: { mode: PlanarClipMaskMode.Priority, priority: PlanarClipMaskPriority.BackgroundMap, transparency: 0 } }),
      moq.Times.once(),
    );

    // turn if OFF again
    toggles
      .at(getToggleIndex("overrideMaskTransparency"))
      .find("input")
      .simulate("change", { target: { checked: false } });
    component.update();

    viewportMock.verify(
      (x) =>
        x.changeBackgroundMapProps({
          planarClipMask: { mode: PlanarClipMaskMode.Priority, priority: PlanarClipMaskPriority.BackgroundMap, transparency: undefined },
        }),
      moq.Times.exactly(2),
    );
    component.unmount();
  });

  it("ground bias", () => {
    const component = mountComponent();
    const numericInputs = component.find(QuantityNumberInput);

    viewportMock.verify((x) => x.changeBackgroundMapProps(moq.It.isAny()), moq.Times.never());
    const oneStepIncrementValue = 1; // 1 foot
    const oneStepFiredValue = oneStepIncrementValue * 0.3048; // .. in meters

    changeNumericInputValue(numericInputs.at(getQuantityNumericInputIndex("groundBias")), oneStepIncrementValue);
    viewportMock.verify((x) => x.changeBackgroundMapProps({ groundBias: oneStepFiredValue }), moq.Times.once());
    component.unmount();
  });

  it("terrainOrigin", () => {
    const component = mountComponent();
    const numericInputs = component.find(QuantityNumberInput);
    viewportMock.verify((x) => x.changeBackgroundMapProps(moq.It.isAny()), moq.Times.never());

    // turn on the 'terrain' toggle then change the input value
    const toggles = component.find(ToggleSwitch);
    toggles
      .at(getToggleIndex("terrain"))
      .find("input")
      .simulate("change", { target: { checked: true } });

    const oneStepIncrementValue = 1; // 1 foot
    const oneStepFiredValue = oneStepIncrementValue * 0.3048; // .. in meters

    changeNumericInputValue(numericInputs.at(getQuantityNumericInputIndex("terrainOrigin")), oneStepIncrementValue);

    viewportMock.verify((x) => x.changeBackgroundMapProps({ terrainSettings: { heightOrigin: oneStepFiredValue } }), moq.Times.once());
    component.unmount();
  });

  it("exaggeration", () => {
    const component = mountComponent();
    const exaggerationInput = component.find(Input).filterWhere((input) =>input.props()["data-testid"] === "exaggeration-input");

    viewportMock.verify((x) => x.changeBackgroundMapProps(moq.It.isAny()), moq.Times.never());

    // turn ON the 'terrain' toggle then change the input value
    const toggles = component.find(ToggleSwitch);
    toggles
      .at(getToggleIndex("terrain"))
      .find("input")
      .simulate("change", { target: { checked: true } });

    exaggerationInput.props().onChange!({ target: { value: "1" } } as React.ChangeEvent<HTMLInputElement>);
    exaggerationInput.simulate("keydown", { key: "Enter" });
    exaggerationInput.update();

    viewportMock.verify((x) => x.changeBackgroundMapProps({ terrainSettings: { exaggeration: 1 } }), moq.Times.once());
    component.unmount();
  });

  it("heightOriginMode geoid", () => {
    const component = mountComponent();

    viewportMock.verify((x) => x.changeBackgroundMapProps(moq.It.isAny()), moq.Times.never());

    // turn ON the 'terrain' toggle then change the combo box value
    const toggles = component.find(ToggleSwitch);
    toggles
      .at(getToggleIndex("terrain"))
      .find("input")
      .simulate("change", { target: { checked: true } });

    const select = component.find(Select);
    select.props().onChange!("geoid", {
      target: { value: "added" }
    } as ChangeEvent<HTMLSelectElement> & SelectValueChangeEvent);
    viewportMock.verify((x) => x.changeBackgroundMapProps({ terrainSettings: { heightOriginMode: TerrainHeightOriginMode.Geoid } }), moq.Times.once());
    component.unmount();
  });

  it("heightOriginMode geodetic", () => {
    const component = mountComponent();

    viewportMock.verify((x) => x.changeBackgroundMapProps(moq.It.isAny()), moq.Times.never());

    // turn ON the 'terrain' toggle then change the combo box value
    const toggles = component.find(ToggleSwitch);
    toggles
      .at(getToggleIndex("terrain"))
      .find("input")
      .simulate("change", { target: { checked: true } });

    const select = component.find(Select);
    select.props().onChange!("geodetic", {
      target: { value: "added" }
    } as ChangeEvent<HTMLSelectElement> & SelectValueChangeEvent);
    viewportMock.verify((x) => x.changeBackgroundMapProps({ terrainSettings: { heightOriginMode: TerrainHeightOriginMode.Geodetic } }), moq.Times.once());
    component.unmount();
  });

  it("heightOriginMode ground", () => {
    const component = mountComponent();

    viewportMock.verify((x) => x.changeBackgroundMapProps(moq.It.isAny()), moq.Times.never());

    // turn ON the 'terrain' toggle then change the combo box value
    const toggles = component.find(ToggleSwitch);
    toggles
      .at(getToggleIndex("terrain"))
      .find("input")
      .simulate("change", { target: { checked: true } });

    const select = component.find(Select);
    select.props().onChange!("ground", {
      target: { value: "added" }
    } as ChangeEvent<HTMLSelectElement> & SelectValueChangeEvent);
    viewportMock.verify((x) => x.changeBackgroundMapProps({ terrainSettings: { heightOriginMode: TerrainHeightOriginMode.Ground } }), moq.Times.once());
    component.unmount();
  });
});
