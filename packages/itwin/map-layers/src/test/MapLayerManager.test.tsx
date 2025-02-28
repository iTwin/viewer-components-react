/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
import { ImageMapLayerSettings } from "@itwin/core-common";
import { MapLayerIndex, MapLayerSource, MapLayerSources, MockRender } from "@itwin/core-frontend";
import { fireEvent, getAllByTestId, getByTestId, queryAllByTestId, queryByText, render, RenderResult } from "@testing-library/react";
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

  const viewportMock = new ViewportMock();

  const attachLayerButtonSelector = ".map-manager-attach-layer-button";
  const sourceListSelector = ".map-manager-source-list";

  beforeAll(async () => {
    await MockRender.App.startup();
    await TestUtils.initialize();
    window.HTMLElement.prototype.scrollIntoView = () => {};
  });

  afterAll(async () => {
    await MockRender.App.shutdown();
    TestUtils.terminateUiComponents();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    viewportMock.reset();
  });

  beforeEach(() => {
    viewportMock.setup();
  });

  async function testSourceItems(testFunc: (menuItems: NodeListOf<HTMLLIElement>) => void, customDataset?: any, nbRender?: number, extraFunc?: () => void) {
    vi.spyOn(MapLayerPreferences, "getSources").mockImplementation(async (_iTwinId: GuidString, _iModelId?: GuidString) => {
      const dataset = customDataset ? customDataset : sourceDataset;
      return dataset.map((source: any) => MapLayerSource.fromJSON(source)!);
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
      await TestUtils.flushAsyncOperations();
    }

    const addButton = container.querySelector(attachLayerButtonSelector) as HTMLElement;
    expect(addButton).toBeDefined();
    fireEvent.click(addButton);

    const sourceList = document.querySelector(sourceListSelector) as HTMLUListElement;
    expect(sourceList).toBeDefined();
    testFunc(sourceList.querySelectorAll('div[role="listitem"]'));
  }

  it("renders base maps", async () => {
    const { container } = render(
      <div>
        <MapLayerManager getContainerForClone={() => document.body} activeViewport={viewportMock.object}></MapLayerManager>
      </div>,
    ) as RenderResult;

    await TestUtils.flushAsyncOperations();

    viewportMock.onMapImageryChanged.raiseEvent({} as any);
    const select = getByTestId<HTMLInputElement>(container, "base-map-select");
    const selectButton = select.querySelector('div[role="combobox"]') as HTMLElement;
    fireEvent.click(selectButton);
    const listboxes = container.querySelectorAll('div[role="listbox"]');
    expect(listboxes.length).toBeGreaterThan(0);
    const menu = listboxes[0] as HTMLUListElement;
    expect(menu).toBeDefined();
    const menuItems = menu.querySelectorAll('button[role="option"]');

    expect(menuItems.length).toBe(4);
    expect(menuItems[0].textContent).toBe("Basemap.ColorFill");
    expect(menuItems[1].textContent).toBe("WellKnownBaseMaps.BingProvider.Aerial");
    expect(menuItems[2].textContent).toBe("WellKnownBaseMaps.BingProvider.Hybrid");
    expect(menuItems[3].textContent).toBe("WellKnownBaseMaps.BingProvider.Street");
  });

  it("renders source list", async () => {
    await testSourceItems(async (sourceItems: NodeListOf<HTMLLIElement>) => {
      expect(sourceItems.length).toBe(2);

      // reverse order because sources should be sorted by name
      expect(sourceItems[0].textContent).toBe(sourceDataset[1].name);
      expect(sourceItems[1].textContent).toBe(sourceDataset[0].name);
    });
  });

  it("renders source list once when loaded twice", async () => {
    await testSourceItems(
      async (sourceItems: NodeListOf<HTMLLIElement>) => {
        expect(sourceItems.length).toBe(2);
      },
      undefined,
      2,
    );
  });

  it("renders source list without duplicates", async () => {
    const customDataset: MapLayerSources[] = [...sourceDataset, sourceDataset[0]];
    vi.spyOn(MapLayerPreferences, "getSources").mockImplementation(async (_iTwinId: GuidString, _iModelId?: GuidString) => {
      return customDataset.map((source: any) => MapLayerSource.fromJSON(source)!);
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

    const addButton = container.querySelector(attachLayerButtonSelector) as HTMLElement;
    expect(addButton).toBeDefined();
    fireEvent.click(addButton);

    const sourceList = document.querySelector(sourceListSelector) as HTMLUListElement;
    expect(sourceList).toBeDefined();
    const sourceItems = sourceList.querySelectorAll('div[role="listitem"]');

    // this should still be 2 even though we added a duplicate
    expect(sourceItems.length).toBe(2);
  });

  it("should remove source item after 'onLayerSourceChanged' delete event", async () => {
    await testSourceItems(
      async (sourceItems: NodeListOf<HTMLLIElement>) => {
        expect(sourceItems.length).toBe(1);
        expect(sourceItems[0].textContent).toBe(sourceDataset[1].name);
      },
      undefined,
      1,
      () => {
        MapLayerPreferences.onLayerSourceChanged.raiseEvent(MapLayerSourceChangeType.Removed, MapLayerSource.fromJSON(sourceDataset[0]));
      },
    );
  });

  it("should rename source item after 'onLayerSourceChanged' renamed event", async () => {
    const renamedName = "RenamedSource";

    await testSourceItems(
      async (sourceItems: NodeListOf<HTMLLIElement>) => {
        expect(sourceItems.length).toBe(2);
        expect(sourceItems[1].textContent).toBe(sourceDataset[1].name);
        expect(sourceItems[0].textContent).toBe(renamedName);
      },
      undefined,
      1,
      () => {
        MapLayerPreferences.onLayerSourceChanged.raiseEvent(
          MapLayerSourceChangeType.Replaced,
          MapLayerSource.fromJSON(sourceDataset[0]),
          MapLayerSource.fromJSON({ ...sourceDataset[0], name: renamedName }),
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
        expect(sourceItems.length).toBe(3);
        expect(sourceItems[2].textContent).toBe(newSourceProps.name);
      },
      undefined,
      1,
      async () => {
        const newSource = MapLayerSource.fromJSON(newSourceProps);
        MapLayerPreferences.onLayerSourceChanged.raiseEvent(MapLayerSourceChangeType.Added, undefined,  newSource);
        // Give React time to process the state update
        await TestUtils.flushAsyncOperations();
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
      layerCheckboxes.every((value) => expect(value.checked).toBe(false));
      expect(selectAllCheckbox.checked).toBe(false);

      // Clicking on the 'select all' checkbox in the header, should check all layer checkboxes
      selectAllCheckbox.click();
      expect(layerCheckboxes.every((value) => value.checked)).toBe(true);
      expect(selectAllCheckbox.checked).toBe(true);

      // Clicking again should deselect all layer checkboxes
      selectAllCheckbox.click();
      expect(layerCheckboxes.every((value) => !value.checked)).toBe(true);
      expect(selectAllCheckbox.checked).toBe(false);

      // 'Select all checkbox' should be check when a single layer is checked
      layerCheckboxes[0].click();
      expect(layerCheckboxes[0].checked).toBe(true);
      expect(selectAllCheckbox.checked).toBe(true);

      // Clicking 'Select all checkbox' at this point should deselect all layers checkbox
      selectAllCheckbox.click();
      expect(layerCheckboxes.every((value) => value.checked)).toBe(false);
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
    viewportMock.detachMapLayerByIndexFunc = (mapLayerIndex: MapLayerIndex) => {
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
      expect(listItem).toBeDefined();
      const detachAllButton = getByTestId(section, "detach-label-button");
      expect(detachAllButton).toBeDefined();

      const checkbox = getByTestId(section, "select-item-checkbox");
      checkbox.click();

      // Click on the detachAll button of the background section, it should clear layer items *only* in the background section
      detachAllButton.click();
      await TestUtils.flushAsyncOperations();

      listItem = queryByText(container, sectionName);
      expect(listItem).toBeNull();
    };
    const layersSections = container.querySelectorAll<HTMLElement>(".map-manager-layer-wrapper");
    await checkLayerSection(layersSections[0], backgroundLayerSettings.name);
    await checkLayerSection(layersSections[1], overlayLayerSetting.name);
  });

  it("should change layers visibility", async () => {
    const checkLayerItemsVisibility = (element: HTMLElement, nbVisibleLayers: number, nbNonVisibleLayers: number) => {
      const iconVisibilityIcons = queryAllByTestId(element, "layer-visibility-icon-show");
      expect(iconVisibilityIcons.length).toBe(nbVisibleLayers);
      const iconInvisibilityIcons = queryAllByTestId(element, "layer-visibility-icon-hide");
      expect(iconInvisibilityIcons.length).toBe(nbNonVisibleLayers);
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
      const hideAllButton = getByTestId(section, "hide-all-label-button");
      expect(hideAllButton).toBeDefined();
      hideAllButton.click();
      await TestUtils.flushAsyncOperations();
      checkLayerItemsVisibility(section, 0, 1);

      // Click on the ShowAll  it should change the eye icon
      const showAllButton = getByTestId(section, "show-all-label-button");
      expect(showAllButton).toBeDefined();
      showAllButton.click();
      await TestUtils.flushAsyncOperations();
      checkLayerItemsVisibility(section, 1, 0);

      // Click on the InvertAll  it should change the eye icon
      const InvertButton = getByTestId(section, "invert-all-label-button");
      expect(InvertButton).toBeDefined();
      InvertButton.click();
      await TestUtils.flushAsyncOperations();
      checkLayerItemsVisibility(section, 0, 1);
    };

    const layersSections = container.querySelectorAll<HTMLElement>(".map-manager-layer-wrapper");
    await checkLayerSection(layersSections[0]);
    await checkLayerSection(layersSections[1]);
  });
});
