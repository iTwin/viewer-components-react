/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
/* eslint-disable deprecation/deprecation */
/* eslint-disable @itwin/no-internal */

import { expect, should } from "chai";
import * as sinon from "sinon";
import { ImageMapLayerSettings } from "@itwin/core-common";
import * as coreFrontend from "@itwin/core-frontend";
import { fireEvent, getAllByTestId, getByTestId, getByTitle, queryByText, render } from "@testing-library/react";
import { MapLayerPreferences, MapLayerSourceChangeType } from "../MapLayerPreferences";
import { MapLayerManager } from "../ui/widget/MapLayerManager";
import { TestUtils } from "./TestUtils";
import { ViewportMock } from "./ViewportMock";

import type { GuidString } from "@itwin/core-bentley";
describe("MapLayerManager", () => {
  const sourceDataset: any = [
    { formatId: "ArcGIS", name: "source2", url: "https://test.com/Mapserver" },
    { formatId: "ArcGIS", name: "source1", url: "https://test.com/Mapserver" },
  ];

  const sandbox = sinon.createSandbox();
  const viewportMock = new ViewportMock();

  const attachLAyerButtonSelector = ".map-manager-attach-layer-button";
  const sourceListSelector = ".map-manager-source-list";

  before(async () => {
    await coreFrontend.MockRender.App.startup();
    await TestUtils.initialize();
    window.HTMLElement.prototype.scrollIntoView = function () {}; // needed by <Select> UI component
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

  async function testSourceItems(testFunc: (menuItems: NodeListOf<HTMLLIElement>) => void, customDataset?: any, nbRender?: number, extraFunc?: () => void) {
    sandbox.stub(MapLayerPreferences, "getSources").callsFake(async function (_iTwinId: GuidString, _iModelId?: GuidString) {
      const dataset = customDataset ? customDataset : sourceDataset;
      return dataset.map((source: any) => coreFrontend.MapLayerSource.fromJSON(source)!);
    });

    render(
      <div>
        <MapLayerManager getContainerForClone={() => document.body} activeViewport={viewportMock.object}></MapLayerManager>
      </div>,
    );
    let renderResult = render(
      <div>
        <MapLayerManager getContainerForClone={() => document.body} activeViewport={viewportMock.object}></MapLayerManager>
      </div>,
    );

    // Make additional render if needed
    const renderTimes = nbRender && nbRender > 2 ? nbRender - 1 : 0;
    if (renderTimes > 0) {
      Array.from(Array(renderTimes)).forEach(() => {
        renderResult = render(
          <div>
            <MapLayerManager getContainerForClone={() => document.body} activeViewport={viewportMock.object}></MapLayerManager>
          </div>,
        );
      });
    }
    const { container } = renderResult;
    await TestUtils.flushAsyncOperations();

    if (extraFunc) {
      extraFunc();
    }

    const addButton = container.querySelector(attachLAyerButtonSelector) as HTMLElement;
    should().exist(addButton);
    fireEvent.click(addButton);

    const sourceList = document.querySelector(sourceListSelector) as HTMLUListElement;
    should().exist(sourceList);
    testFunc(sourceList.querySelectorAll("li"));
  }

  it("renders base maps", async () => {
    const { container } = render(
      <div>
        <MapLayerManager getContainerForClone={() => document.body} activeViewport={viewportMock.object}></MapLayerManager>
      </div>,
    );

    await TestUtils.flushAsyncOperations();

    viewportMock.onMapImageryChanged.raiseEvent({} as any);

    const select = container.querySelector(".iui-input-with-icon") as HTMLElement;
    const selectButton = select.querySelector(".iui-select-button") as HTMLElement;
    fireEvent.click(selectButton);
    const menu = document.querySelector(".iui-menu") as HTMLUListElement;
    should().exist(menu);
    const menuItems = menu.querySelectorAll("li");

    expect(menuItems.length).to.eq(4);
    expect(menuItems[0].textContent).to.eql("Basemap.ColorFill");
    expect(menuItems[1].textContent).to.eql("WellKnownBaseMaps.BingProvider.Aerial");
    expect(menuItems[2].textContent).to.eql("WellKnownBaseMaps.BingProvider.Hybrid");
    expect(menuItems[3].textContent).to.eql("WellKnownBaseMaps.BingProvider.Street");
  });

  it("renders source list", async () => {
    await testSourceItems(async (sourceItems: NodeListOf<HTMLLIElement>) => {
      expect(sourceItems.length).to.eq(2);

      // reverse order because sources should be sorted by name
      expect(sourceItems[0].textContent).to.eql(sourceDataset[1].name);
      expect(sourceItems[1].textContent).to.eql(sourceDataset[0].name);
    });
  });

  it("renders source list once when loaded twice  ", async () => {
    await testSourceItems(
      async (sourceItems: NodeListOf<HTMLLIElement>) => {
        expect(sourceItems.length).to.eq(2);
      },
      undefined,
      2,
    );
  });

  it("renders source list without duplicates", async () => {
    const customDataset: coreFrontend.MapLayerSources[] = [...sourceDataset, sourceDataset[0]];
    sandbox.stub(MapLayerPreferences, "getSources").callsFake(async function (_iTwinId: GuidString, _iModelId?: GuidString) {
      return customDataset.map((source: any) => coreFrontend.MapLayerSource.fromJSON(source)!);
    });

    render(
      <div>
        <MapLayerManager getContainerForClone={() => document.body} activeViewport={viewportMock.object}></MapLayerManager>
      </div>,
    );
    const { container } = render(
      <div>
        <MapLayerManager getContainerForClone={() => document.body} activeViewport={viewportMock.object}></MapLayerManager>
      </div>,
    );

    await TestUtils.flushAsyncOperations();

    const addButton = container.querySelector(attachLAyerButtonSelector) as HTMLElement;
    should().exist(addButton);
    fireEvent.click(addButton);

    const sourceList = document.querySelector(sourceListSelector) as HTMLUListElement;
    should().exist(sourceList);
    const sourceItems = sourceList.querySelectorAll("li");

    // this should still be 2 even though we added a duplicate
    expect(sourceItems.length).to.eq(2);
  });

  it("should remove source item after 'onLayerSourceChanged' delete event", async () => {
    await testSourceItems(
      async (sourceItems: NodeListOf<HTMLLIElement>) => {
        expect(sourceItems.length).to.eq(1);
        expect(sourceItems[0].textContent).to.eql(sourceDataset[1].name);
      },
      undefined,
      1,
      () => {
        MapLayerPreferences.onLayerSourceChanged.raiseEvent(MapLayerSourceChangeType.Removed, coreFrontend.MapLayerSource.fromJSON(sourceDataset[0]));
      },
    );
  });

  it("should rename source item after 'onLayerSourceChanged' renamed event", async () => {
    const renamedName = "RenamedSource";
    await testSourceItems(
      async (sourceItems: NodeListOf<HTMLLIElement>) => {
        expect(sourceItems.length).to.eq(2);
        expect(sourceItems[0].textContent).to.eql(sourceDataset[1].name);
        expect(sourceItems[1].textContent).to.eql(renamedName);
      },
      undefined,
      1,
      () => {
        MapLayerPreferences.onLayerSourceChanged.raiseEvent(
          MapLayerSourceChangeType.Replaced,
          coreFrontend.MapLayerSource.fromJSON(sourceDataset[0]),
          coreFrontend.MapLayerSource.fromJSON({ ...sourceDataset[0], name: renamedName }),
        );
      },
    );
  });

  it("should add source item after 'onLayerSourceChanged' added event", async () => {
    const newSourceProps = {
      formatId: "ArcGIS",
      name: "source3",
      url: "https://test.com/Mapserver",
    };

    await testSourceItems(
      async (sourceItems: NodeListOf<HTMLLIElement>) => {
        expect(sourceItems.length).to.eq(3);
        expect(sourceItems[2].textContent).to.eql(newSourceProps.name);
      },
      undefined,
      1,
      () => {
        MapLayerPreferences.onLayerSourceChanged.raiseEvent(MapLayerSourceChangeType.Added, coreFrontend.MapLayerSource.fromJSON(newSourceProps));
      },
    );
  });

  it("should maintain checkboxes in synch", async () => {
    viewportMock.reset();
    const layer1 = ImageMapLayerSettings.fromJSON({
      formatId: "WMS",
      name: "layer1",
      visible: true,
      transparentBackground: true,
      subLayers: [{ name: "subLayer1", visible: false }],
      accessKey: undefined,
      transparency: 0,
      url: "https://server/MapServer",
    });
    const layer2 = ImageMapLayerSettings.fromJSON({ ...layer1.toJSON(), name: "layer2" });
    viewportMock.backgroundLayers = [layer1, layer2];
    viewportMock.overlayLayers = [layer1, layer2];
    viewportMock.setup();

    const renderResult = render(
      <div>
        <MapLayerManager getContainerForClone={() => document.body} activeViewport={viewportMock.object}></MapLayerManager>
      </div>,
    );
    const { container } = renderResult;
    await TestUtils.flushAsyncOperations();

    const layerSections = getAllByTestId(container, "map-manager-layer-section");

    const doLayerSectionTests = (section: HTMLElement) => {
      const selectAllCheckbox = getByTestId<HTMLInputElement>(section, "select-all-checkbox");
      const layerCheckboxes = getAllByTestId<HTMLInputElement>(section, "select-item-checkbox");

      // Make sure that initially all checkboxes are not checked
      layerCheckboxes.every((value) => !value.checked);
      expect(selectAllCheckbox.checked).to.be.false;

      // Clicking on the 'select all' checkbox in the header, should check all layer checkboxes
      selectAllCheckbox.click();
      expect(layerCheckboxes.every((value) => value.checked)).to.be.true;
      expect(selectAllCheckbox.checked).to.be.true;

      // Clicking again should deselect all layer checkboxes
      selectAllCheckbox.click();
      expect(layerCheckboxes.every((value) => !value.checked)).to.be.true;
      expect(selectAllCheckbox.checked).to.be.false;

      // 'Select all checkbox' should be check when a single layer is checked
      layerCheckboxes[0].click();
      expect(layerCheckboxes[0].checked).to.be.true;
      expect(selectAllCheckbox.checked).to.be.true;

      // Clicking 'Select all checkbox' at this point should deselect all layers checkbox
      selectAllCheckbox.click();
      expect(layerCheckboxes.every((value) => value.checked)).to.be.false;
    };
    doLayerSectionTests(layerSections[0]);
    doLayerSectionTests(layerSections[1]);
  });

  it("should detach layers", async () => {
    viewportMock.reset();
    const backgroundLayerSettings = ImageMapLayerSettings.fromJSON({
      formatId: "WMS",
      name: "background",
      visible: true,
      transparentBackground: true,
      subLayers: [{ name: "subLayer1", visible: false }],
      accessKey: undefined,
      transparency: 0,
      url: "https://server/MapServer",
    });
    const overlayLayerSetting = ImageMapLayerSettings.fromJSON({ ...backgroundLayerSettings.toJSON(), name: "overlay" });
    viewportMock.backgroundLayers = [backgroundLayerSettings];
    viewportMock.overlayLayers = [overlayLayerSetting];
    viewportMock.detachMapLayerByIndexFunc = (mapLayerIndex: coreFrontend.MapLayerIndex) => {
      mapLayerIndex.isOverlay ? (viewportMock.overlayLayers = []) : (viewportMock.backgroundLayers = []);
    };
    viewportMock.setup();
    const renderResult = render(
      <div>
        <MapLayerManager getContainerForClone={() => document.body} activeViewport={viewportMock.object}></MapLayerManager>
      </div>,
    );
    const { container } = renderResult;
    await TestUtils.flushAsyncOperations();

    const checkLayerSection = async (section: HTMLElement, sectionName: string) => {
      let listItem = queryByText(container, sectionName);
      should().exist(listItem);
      const detachAllButton = getByTitle(section, "MapLayerActionButtons.DetachSelectedLabel");
      should().exist(detachAllButton);

      const checkbox = getByTestId(section, "select-item-checkbox");
      checkbox.click();

      // Click on the detachAll button of the background section, it should clear layer items *only* in the background section
      detachAllButton.click();
      await TestUtils.flushAsyncOperations();

      listItem = queryByText(container, sectionName);
      should().not.exist(listItem);
    };
    const layersSections = container.querySelectorAll<HTMLElement>(".map-manager-layer-wrapper");
    await checkLayerSection(layersSections[0], backgroundLayerSettings.name);
    await checkLayerSection(layersSections[1], overlayLayerSetting.name);
  });

  it("should change layers visibility", async () => {
    const checkLayerItemsVisibility = (element: HTMLElement, nbVisibleLayers: number, nbNonVisibleLayers: number) => {
      const iconVisibilityIcons = element.querySelectorAll("i.icon-visibility");
      expect(iconVisibilityIcons.length).to.eq(nbVisibleLayers);
      const iconInvisibilityIcons = element.querySelectorAll("i.icon-visibility-hide-2");
      expect(iconInvisibilityIcons.length).to.eq(nbNonVisibleLayers);
    };

    viewportMock.reset();
    const backgroundLayerSettings = ImageMapLayerSettings.fromJSON({
      formatId: "WMS",
      name: "background",
      visible: true,
      transparentBackground: true,
      subLayers: [{ name: "subLayer1", visible: false }],
      accessKey: undefined,
      transparency: 0,
      url: "https://server/MapServer",
    });
    const overlayLayerSetting = ImageMapLayerSettings.fromJSON({ ...backgroundLayerSettings.toJSON(), name: "overlay" });
    viewportMock.backgroundLayers = [backgroundLayerSettings];
    viewportMock.overlayLayers = [overlayLayerSetting];

    viewportMock.setup();
    const renderResult = render(
      <div>
        <MapLayerManager getContainerForClone={() => document.body} activeViewport={viewportMock.object}></MapLayerManager>
      </div>,
    );
    const { container } = renderResult;
    await TestUtils.flushAsyncOperations();

    const checkLayerSection = async (section: HTMLElement) => {
      checkLayerItemsVisibility(section, 1, 0);

      // Click on the HideAll  it should change the eye icon

      // const hideAllButtons = getAllByTitle(container, "MapLayerActionButtons.HideAllLabel");
      const hideAllButton = getByTitle(section, "MapLayerActionButtons.HideAllLabel");
      should().exist(hideAllButton);
      hideAllButton.click();
      await TestUtils.flushAsyncOperations();
      checkLayerItemsVisibility(section, 0, 1);

      // Click on the HideAll  it should change the eye icon
      const showAllButton = getByTitle(section, "MapLayerActionButtons.ShowAllLabel");
      should().exist(showAllButton);
      showAllButton.click();
      await TestUtils.flushAsyncOperations();
      checkLayerItemsVisibility(section, 1, 0);

      // Click on the HideAll  it should change the eye icon
      const InvertButton = getByTitle(section, "MapLayerActionButtons.InvertAllLabel");
      should().exist(InvertButton);
      InvertButton.click();
      await TestUtils.flushAsyncOperations();
      checkLayerItemsVisibility(section, 0, 1);
    };

    const layersSections = container.querySelectorAll<HTMLElement>(".map-manager-layer-wrapper");
    await checkLayerSection(layersSections[0]);
    await checkLayerSection(layersSections[1]);
  });
});
