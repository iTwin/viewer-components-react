/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/* eslint-disable deprecation/deprecation */

import { expect, should } from "chai";
import * as React from "react";
import * as sinon from "sinon";
import * as moq from "typemoq";
import { fireEvent, render } from "@testing-library/react";
import { DisplayStyle3dState, IModelConnection, MapLayerScaleRangeVisibility, MapLayerSource, MapLayerSources, MockRender, ScreenViewport, Viewport, ViewState3d } from "@itwin/core-frontend";
import { MapLayerManager } from "../ui/widget/MapLayerManager";
import { TestUtils } from "./TestUtils";
import { BackgroundMapProvider, BackgroundMapType, BaseMapLayerSettings, DisplayStyle3dSettings, MapImagerySettings, ViewFlags} from "@itwin/core-common";
import { BeEvent, GuidString } from "@itwin/core-bentley";
import { MapLayerPreferences, MapLayerSourceChangeType } from "../MapLayerPreferences";

describe.only("MapLayerManager", () => {
  const sourceDataset: any = [
    { formatId: "ArcGIS",
      name: "source2",
      url: "https://test.com/Mapserver" },
    { formatId: "ArcGIS",
      name: "source1",
      url: "https://test.com/Mapserver" },
  ];

  const sandbox = sinon.createSandbox();
  const viewportMock = moq.Mock.ofType<ScreenViewport>();
  const viewMock = moq.Mock.ofType<ViewState3d>();
  const displayStyleMock = moq.Mock.ofType<DisplayStyle3dState>();
  const imodelMock = moq.Mock.ofType<IModelConnection>();
  const displayStyleSettingsMock = moq.Mock.ofType<DisplayStyle3dSettings>();
  const mapImageryMock = moq.Mock.ofType<MapImagerySettings>();
  const viewsFlagsMock = moq.Mock.ofType<ViewFlags>();

  const attachLAyerButtonSelector = ".map-manager-attach-layer-button";
  const sourceListSelector = ".map-manager-source-list";

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
  });

  beforeEach(() => {
    viewsFlagsMock.reset();
    viewsFlagsMock.setup((flags) => flags.backgroundMap).returns(() => true );

    mapImageryMock.reset();
    mapImageryMock.setup((mapImagery) => mapImagery.backgroundBase).returns(() => BaseMapLayerSettings.fromJSON(BaseMapLayerSettings.fromProvider(BackgroundMapProvider.fromJSON({name: "BingProvider", type: BackgroundMapType.Hybrid} ))));
    mapImageryMock.setup((mapImagery) => mapImagery.backgroundLayers).returns(() => []);
    mapImageryMock.setup((mapImagery) => mapImagery.overlayLayers).returns(() => []);

    displayStyleSettingsMock.reset();
    displayStyleSettingsMock.setup((dsSettings) => dsSettings.mapImagery).returns(() => mapImageryMock.object);
    displayStyleSettingsMock.setup((dsSettings) => dsSettings.onMapImageryChanged).returns(() => new BeEvent<(newImagery: Readonly<MapImagerySettings>) => void>());

    displayStyleMock.reset();
    displayStyleMock.setup((ds) => ds.settings).returns(() => displayStyleSettingsMock.object);
    imodelMock.reset();
    imodelMock.setup((iModel) => iModel.iModelId).returns(() => "fakeGuid");
    imodelMock.setup((iModel) => iModel.iTwinId).returns(() => "fakeGuid");

    viewMock.reset();
    viewMock.setup((view) => view.iModel).returns(() => imodelMock.object);
    viewportMock.reset();
    viewportMock.setup((viewport) => viewport.iModel).returns(() => viewMock.object.iModel);
    viewportMock.setup((viewport) => viewport.view).returns(() => viewMock.object);
    viewportMock.setup((viewport) => viewport.viewFlags).returns(() => viewsFlagsMock.object);
    viewportMock.setup((viewport) => viewport.displayStyle).returns(() => displayStyleMock.object);
    viewportMock.setup((viewport) => viewport.onDisplayStyleChanged).returns(() => new BeEvent<(vp: Viewport) => void>());
    viewportMock.setup((viewport) => viewport.onMapLayerScaleRangeVisibilityChanged).returns(() => new BeEvent<(layerIndexes: MapLayerScaleRangeVisibility[]) => void>());
  });

  async function  testSourceItems(testFunc: (menuItems: NodeListOf<HTMLLIElement>)  => void, customDataset?: any, nbRender?: number, extraFunc?: () => void) {
    sandbox.stub(MapLayerPreferences, "getSources").callsFake(async function ( _iTwinId: GuidString, _iModelId?: GuidString) {
      const dataset = customDataset ? customDataset : sourceDataset;
      return dataset.map((source: any)=> MapLayerSource.fromJSON(source)!);
    });

    render(<div><MapLayerManager getContainerForClone={() => document.body}  activeViewport={viewportMock.object} ></MapLayerManager></div>);
    let renderResult = render(<div><MapLayerManager getContainerForClone={() => document.body} activeViewport={viewportMock.object} ></MapLayerManager></div>);

    // Make additional render if needed
    const renderTimes = nbRender && nbRender > 2 ? nbRender-1 : 0;
    if (renderTimes > 0) {
      Array.from(Array(renderTimes)).forEach(() => {
        renderResult = render(<div><MapLayerManager getContainerForClone={() => document.body} activeViewport={viewportMock.object} ></MapLayerManager></div>);
      });
    }

    const {container} = renderResult;
    await TestUtils.flushAsyncOperations();

    if (extraFunc)
      extraFunc();

    const addButton = container.querySelector(attachLAyerButtonSelector) as HTMLElement;
    should().exist(addButton);
    fireEvent.click(addButton);

    const sourceList = document.querySelector(sourceListSelector) as HTMLUListElement;
    should().exist(sourceList);
    testFunc(sourceList.querySelectorAll("li"));

  }

  it("renders base maps", async () => {
    const { container } = render(<div><MapLayerManager getContainerForClone={() => document.body}  activeViewport={viewportMock.object} ></MapLayerManager></div>);

    await TestUtils.flushAsyncOperations();

    const select = container.querySelector(".iui-input-with-icon") as HTMLElement;
    const selectButton = select.querySelector(".iui-select-button") as HTMLElement;
    fireEvent.click(selectButton);
    const menu = document.querySelector(".iui-menu") as HTMLUListElement;
    should().exist(menu);
    const menuItems = menu.querySelectorAll("li");

    expect(menuItems.length).to.eq(4);
    expect(menuItems[0].textContent).to.eql("Basemap.ColorFill");
    expect(menuItems[1].textContent).to.eql("Bing Maps: Aerial Imagery");
    expect(menuItems[2].textContent).to.eql("Bing Maps: Aerial Imagery with labels");
    expect(menuItems[3].textContent).to.eql("Bing Maps: Streets");

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

    await testSourceItems(async (sourceItems: NodeListOf<HTMLLIElement>) => {
      expect(sourceItems.length).to.eq(2);
    },
    undefined,
    2);
  });

  it("renders source list without duplicates", async () => {
    const customDataset: MapLayerSources[] = [...sourceDataset, sourceDataset[0]];
    sandbox.stub(MapLayerPreferences, "getSources").callsFake(async function ( _iTwinId: GuidString, _iModelId?: GuidString) {
      return customDataset.map((source: any)=> MapLayerSource.fromJSON(source)!);
    });

    render(<div><MapLayerManager getContainerForClone={() => document.body}  activeViewport={viewportMock.object} ></MapLayerManager></div>);
    const { container } = render(<div><MapLayerManager getContainerForClone={() => document.body} activeViewport={viewportMock.object} ></MapLayerManager></div>);

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
    await testSourceItems(async (sourceItems: NodeListOf<HTMLLIElement>) => {
      expect(sourceItems.length).to.eq(1);
      expect(sourceItems[0].textContent).to.eql(sourceDataset[1].name);
    },
    undefined,
    1,
    () => {
      MapLayerPreferences.onLayerSourceChanged.raiseEvent(MapLayerSourceChangeType.Removed, MapLayerSource.fromJSON(sourceDataset[0]));
    });
  });

  it("should rename source item after 'onLayerSourceChanged' renamed event", async () => {
    const renamedName = "RenamedSource";
    await testSourceItems(async (sourceItems: NodeListOf<HTMLLIElement>) => {
      expect(sourceItems.length).to.eq(2);
      expect(sourceItems[0].textContent).to.eql(sourceDataset[1].name);
      expect(sourceItems[1].textContent).to.eql(renamedName);
    },
    undefined,
    1,
    () => {
      MapLayerPreferences.onLayerSourceChanged.raiseEvent(MapLayerSourceChangeType.Replaced,
        MapLayerSource.fromJSON(sourceDataset[0]),
        MapLayerSource.fromJSON({...sourceDataset[0], name: renamedName}));
    });
  });

  it("should add source item after 'onLayerSourceChanged' added event", async () => {
    const newSourceProps = {
      formatId: "ArcGIS",
      name: "source3",
      url: "https://test.com/Mapserver" };

    await testSourceItems(async (sourceItems: NodeListOf<HTMLLIElement>) => {
      expect(sourceItems.length).to.eq(3);
      expect(sourceItems[2].textContent).to.eql(newSourceProps.name);
    },
    undefined,
    1,
    () => {
      MapLayerPreferences.onLayerSourceChanged.raiseEvent(MapLayerSourceChangeType.Added,
        MapLayerSource.fromJSON(newSourceProps) );
    });
  });

});
