/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
import * as moq from "typemoq";
import { PlanarClipMaskMode, PlanarClipMaskPriority, TerrainHeightOriginMode } from "@itwin/core-common";
import { act, fireEvent, getByTestId, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SourceMapContext } from "../ui/widget/MapLayerManager";
import { MapManagerSettings } from "../ui/widget/MapManagerSettings";
import { TestUtils } from "./TestUtils";

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

  beforeAll(async () => {
    // await MockRender.App.startup();
    await TestUtils.initialize();
  });

  afterAll(async () => {
    // await MockRender.App.shutdown();
    TestUtils.terminateUiComponents();
  });

  beforeEach(() => {
    window.HTMLElement.prototype.scrollTo = vi.fn();
    window.HTMLElement.prototype.scrollIntoView = vi.fn();
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

  const refreshFromStyle = vi.fn();

  const renderComponent = () => {
    return render(
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
      </SourceMapContext.Provider>
    );
  };

  it("renders", () => {
    const { unmount } = renderComponent();
    unmount();
  });

  it("Terrain toggle", () => {
    const { container, unmount } = renderComponent();

    const terrainHeightSelectBefore = getByTestId(container, "terrain-height-mode").querySelector('[role="combobox"]');
    expect(terrainHeightSelectBefore!.getAttribute("aria-disabled")).toBe("true");

    expect({
      groundBias: (getByTestId(container, "ground-bias") as HTMLInputElement).disabled,
      terrainOrigin: (getByTestId(container, "terrain-origin") as HTMLInputElement).disabled,
      exaggeration: (getByTestId(container, "exaggeration-input") as HTMLInputElement).disabled,
    }).toEqual({
      groundBias: false,
      terrainOrigin: true,
      exaggeration: true,
    });
    expect(getByTestId(container, "depthBuffer").getAttribute("disabled")).toBe(null);

    // 'changeBackgroundMapProps' should not have been called before terrain is toggled
    viewportMock.verify((x) => x.changeBackgroundMapProps(moq.It.isAny()), moq.Times.never());

    // Toggle terrain
    const terrainToggle = getByTestId(container, "terrain") as HTMLInputElement;
    fireEvent.click(terrainToggle);
    expect(terrainToggle.checked).toBe(true);

    // 'changeBackgroundMapProps' should have been called once now
    viewportMock.verify((x) => x.changeBackgroundMapProps(moq.It.isAny()), moq.Times.once());

    const terrainHeightSelectAfter = getByTestId(container, "terrain-height-mode").querySelector('[role="combobox"]');
    expect(terrainHeightSelectAfter!.getAttribute("aria-disabled")).toBe(null);

    expect({
      groundBias: (getByTestId(container, "ground-bias") as HTMLInputElement).disabled,
      terrainOrigin: (getByTestId(container, "terrain-origin") as HTMLInputElement).disabled,
      exaggeration: (getByTestId(container, "exaggeration-input") as HTMLInputElement).disabled,
    }).toEqual({
      groundBias: true,
      terrainOrigin: false,
      exaggeration: false,
    });

    expect(getByTestId(container, "depthBuffer").getAttribute("disabled")).toBe("");

    unmount();
  });

  // Disabled slider testing until we find a reliable way to 'move' the slider
  it("Transparency slider", () => {
    viewportMock.verify((x) => x.changeBackgroundMapProps(moq.It.isAny()), moq.Times.never());

    const { container, unmount } = renderComponent();

    const sliders = container.querySelectorAll('div[role="slider"]');
    expect(sliders.length).toBe(2);

    act(() => {
      fireEvent.keyUp(sliders[0], { key: "ArrowLeft" });
    });

    viewportMock.verify((x) => x.changeBackgroundMapProps({ transparency: 0 }), moq.Times.once());

    unmount();
  });

  it("Mask Transparency slider", () => {
    viewportMock.verify((x) => x.changeBackgroundMapProps(moq.It.isAny()), moq.Times.never());

    const { container, unmount } = renderComponent();

    const sliders = container.querySelectorAll('div[role="slider"]');
    expect(sliders.length).toBe(2);

    const sliderThumb = sliders[1];

    // Make sure the slider is disabled by default
    expect(sliderThumb?.getAttribute("aria-disabled")).toBe("true");

    // Turn on the mask toggle
    const maskToggle = getByTestId(container, "mask");
    expect(maskToggle).toBeTruthy();
    fireEvent.click(maskToggle);

    // Enabling the 'mask' toggle should set mask transparency to undefined
    viewportMock.verify(
      (x) =>
        x.changeBackgroundMapProps({
          planarClipMask: { mode: PlanarClipMaskMode.Priority, priority: PlanarClipMaskPriority.BackgroundMap, transparency: undefined },
        }),
      moq.Times.once(),
    );

    const overrideMaskTransToggle = getByTestId(container, "overrideMaskTransparency");
    expect(overrideMaskTransToggle).toBeTruthy();
    fireEvent.click(overrideMaskTransToggle);

    // Enabling the 'overrideMaskTransparency' toggle should set mask transparency to 0
    viewportMock.verify(
      (x) =>
        x.changeBackgroundMapProps({ planarClipMask: { mode: PlanarClipMaskMode.Priority, priority: PlanarClipMaskPriority.BackgroundMap, transparency: 0 } }),
      moq.Times.once(),
    );

    expect(sliderThumb?.getAttribute("aria-disabled")).toBe("false");

    // Make sure the slider events are handled
    act(() => {
      fireEvent.keyUp(sliderThumb, { key: "ArrowLeft" });
    });

    viewportMock.verify(
      (x) =>
        x.changeBackgroundMapProps({ planarClipMask: { mode: PlanarClipMaskMode.Priority, priority: PlanarClipMaskPriority.BackgroundMap, transparency: 0 } }),
      moq.Times.exactly(2),
    );

    unmount();
  });

  it("Locatable toggle", () => {
    const { container, unmount } = renderComponent();

    viewportMock.verify((x) => x.changeBackgroundMapProps(moq.It.isAny()), moq.Times.never());

    const locatableToggle = getByTestId(container, "locatable");
    fireEvent.click(locatableToggle);

    // 'changeBackgroundMapProps' should have been called once now
    viewportMock.verify((x) => x.changeBackgroundMapProps({ nonLocatable: true }), moq.Times.once());

    unmount();
  });

  it("Mask toggle", () => {
    const { container, unmount } = renderComponent();

    viewportMock.verify((x) => x.changeBackgroundMapProps(moq.It.isAny()), moq.Times.never());

    const maskToggle = getByTestId(container, "mask");
    fireEvent.click(maskToggle);

    // 'changeBackgroundMapProps' should have been called once now
    viewportMock.verify(
      (x) =>
        x.changeBackgroundMapProps({
          planarClipMask: { mode: PlanarClipMaskMode.Priority, priority: PlanarClipMaskPriority.BackgroundMap, transparency: undefined },
        }),
      moq.Times.once(),
    );

    fireEvent.click(maskToggle);

    viewportMock.verify(
      (x) => x.changeBackgroundMapProps({ planarClipMask: { mode: PlanarClipMaskMode.None } }),
      moq.Times.once()
    );

    unmount();
  });

  it("Override Mask Transparency Toggle", () => {
    viewportMock.verify((x) => x.changeBackgroundMapProps(moq.It.isAny()), moq.Times.never());

    const { container, unmount } = renderComponent();

    // By default, the override toggle should be disabled
    const overrideToggle = getByTestId(container, "overrideMaskTransparency") as HTMLInputElement;
    expect(overrideToggle.disabled).toBe(true);

    // First turn ON the masking toggle
    const maskToggle = getByTestId(container, "mask");
    fireEvent.click(maskToggle);

    // Toggle should be enabled now
    expect(overrideToggle.disabled).toBe(false);

    // Turn ON the override mask transparency
    fireEvent.click(overrideToggle);

    viewportMock.verify(
      (x) =>
        x.changeBackgroundMapProps({ planarClipMask: { mode: PlanarClipMaskMode.Priority, priority: PlanarClipMaskPriority.BackgroundMap, transparency: 0 } }),
      moq.Times.once(),
    );

    // Turn it OFF again
    fireEvent.click(overrideToggle);

    viewportMock.verify(
      (x) =>
        x.changeBackgroundMapProps({
          planarClipMask: { mode: PlanarClipMaskMode.Priority, priority: PlanarClipMaskPriority.BackgroundMap, transparency: undefined },
        }),
      moq.Times.exactly(2),
    );

    unmount();
  });

  it("ground bias", () => {
    const { container, unmount } = renderComponent();

    viewportMock.verify((x) => x.changeBackgroundMapProps(moq.It.isAny()), moq.Times.never());
    const oneStepIncrementValue = 1; // 1 foot
    const oneStepFiredValue = oneStepIncrementValue * 0.3048; // .. in meters

    const groundBiasInput = getByTestId(container, "ground-bias") as HTMLInputElement;
    fireEvent.change(groundBiasInput, { target: { value: oneStepIncrementValue.toString() } });
    fireEvent.keyDown(groundBiasInput, { key: "Enter" });

    viewportMock.verify((x) => x.changeBackgroundMapProps({ groundBias: oneStepFiredValue }), moq.Times.once());

    unmount();
  });

  it("terrainOrigin", () => {
    const { container, unmount } = renderComponent();
    viewportMock.verify((x) => x.changeBackgroundMapProps(moq.It.isAny()), moq.Times.never());

    // turn on the 'terrain' toggle then change the input value
    const terrainToggle = getByTestId(container, "terrain") as HTMLInputElement;
    fireEvent.click(terrainToggle);

    const oneStepIncrementValue = 1; // 1 foot
    const oneStepFiredValue = oneStepIncrementValue * 0.3048; // .. in meters

    const terrainOriginInput = getByTestId(container, "terrain-origin") as HTMLInputElement;
    fireEvent.change(terrainOriginInput, { target: { value: oneStepIncrementValue.toString() } });
    fireEvent.keyDown(terrainOriginInput, { key: "Enter" });

    viewportMock.verify((x) => x.changeBackgroundMapProps({ terrainSettings: { heightOrigin: oneStepFiredValue } }), moq.Times.once());

    unmount();
  });

  it("exaggeration", () => {
    const { container, unmount } = renderComponent();
    viewportMock.verify((x) => x.changeBackgroundMapProps(moq.It.isAny()), moq.Times.never());

    // turn ON the 'terrain' toggle then change the input value
    const terrainToggle = getByTestId(container, "terrain") as HTMLInputElement;
    fireEvent.click(terrainToggle);

    const exaggerationInput = getByTestId(container, "exaggeration-input") as HTMLInputElement;
    fireEvent.change(exaggerationInput, { target: { value: "1" } });
    fireEvent.keyDown(exaggerationInput, { key: "Enter" });

    viewportMock.verify((x) => x.changeBackgroundMapProps({ terrainSettings: { exaggeration: 1 } }), moq.Times.once());

    unmount();
  });

  it("heightOriginMode geoid", async () => {
    const user = userEvent.setup();
    const { container, unmount } = renderComponent();

    viewportMock.verify((x) => x.changeBackgroundMapProps(moq.It.isAny()), moq.Times.never());

    // Turn on terrain toggle first
    const terrainToggle = getByTestId(container, "terrain") as HTMLInputElement;
    fireEvent.click(terrainToggle);

    // Open the height mode dropdown and select 'Geoid'
    const select = getByTestId(container, "terrain-height-mode").querySelector('[role="combobox"]');
    await user.click(select!);

    // Need to use screen to get the listbox as the dropdown is rendered outside the component it seems
    const dropdownId = select?.getAttribute('aria-controls');
    const listboxes = screen.getAllByRole('listbox');
    const targetListbox = listboxes.find(box => box.getAttribute('id') === dropdownId!);

    const dropdownOptions = within(targetListbox!);

    await user.click(dropdownOptions.getByText("Settings.ElevationTypeGeoid"));

    // Verify that the height origin mode is set to 'Geoid'
    viewportMock.verify(
      (x) => x.changeBackgroundMapProps({
        terrainSettings: { heightOriginMode: TerrainHeightOriginMode.Geoid }
      }),
      moq.Times.once()
    );

    unmount();
  });

  it("heightOriginMode geodetic", async () => {
    const user = userEvent.setup();
    const { container, unmount } = renderComponent();

    const terrainToggle = getByTestId(container, "terrain") as HTMLInputElement;
    fireEvent.click(terrainToggle);

    const select = getByTestId(container, "terrain-height-mode").querySelector('[role="combobox"]');
    await user.click(select!);

    // Need to use screen to get the listbox as the dropdown is rendered outside the component it seems
    const dropdownId = select?.getAttribute('aria-controls');
    const listboxes = screen.getAllByRole('listbox');
    const targetListbox = listboxes.find(box => box.getAttribute('id') === dropdownId!);
    const dropdownOptions = within(targetListbox!);

    await user.click(dropdownOptions.getByText("Settings.ElevationTypeGeodetic"));

    viewportMock.verify(
      (x) => x.changeBackgroundMapProps({
        terrainSettings: { heightOriginMode: TerrainHeightOriginMode.Geodetic }
      }),
      moq.Times.once()
    );

    unmount();
  });

  it("heightOriginMode ground", async () => {
      const user = userEvent.setup();
      const { container, unmount } = renderComponent();

      const terrainToggle = getByTestId(container, "terrain") as HTMLInputElement;
      fireEvent.click(terrainToggle);

      const select = getByTestId(container, "terrain-height-mode").querySelector('[role="combobox"]');
      await user.click(select!);

      const dropdownId = select?.getAttribute('aria-controls');
      const listboxes = screen.getAllByRole('listbox');
      const targetListbox = listboxes.find(box => box.getAttribute('id') === dropdownId!);
      const dropdownOptions = within(targetListbox!);

      await user.click(dropdownOptions.getByText("Settings.ElevationTypeGround"));

      viewportMock.verify(
        (x) => x.changeBackgroundMapProps({
          terrainSettings: { heightOriginMode: TerrainHeightOriginMode.Ground }
        }),
        moq.Times.once()
      );

    unmount();
  });
});
