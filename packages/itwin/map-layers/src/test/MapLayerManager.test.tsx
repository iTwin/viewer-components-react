/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/* eslint-disable deprecation/deprecation */

import { expect, should } from "chai";
import * as React from "react";
import * as sinon from "sinon";
import * as coreFrontend from "@itwin/core-frontend";
import { fireEvent, render } from "@testing-library/react";
import { MapLayerManager } from "../ui/widget/MapLayerManager";
import { TestUtils } from "./TestUtils";
import { GuidString } from "@itwin/core-bentley";
import { MapLayerPreferences, MapLayerSourceChangeType } from "../MapLayerPreferences";
import { ViewportMock } from "./ViewportMock";

describe("MapLayerManager", () => {
  const sourceDataset: any = [
    { formatId: "ArcGIS",
      name: "source2",
      url: "https://test.com/Mapserver" },
    { formatId: "ArcGIS",
      name: "source1",
      url: "https://test.com/Mapserver" },
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

  async function  testSourceItems(testFunc: (menuItems: NodeListOf<HTMLLIElement>)  => void, customDataset?: any, nbRender?: number, extraFunc?: () => void) {
    sandbox.stub(MapLayerPreferences, "getSources").callsFake(async function ( _iTwinId: GuidString, _iModelId?: GuidString) {
      const dataset = customDataset ? customDataset : sourceDataset;
      return dataset.map((source: any)=> coreFrontend.MapLayerSource.fromJSON(source)!);
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

    viewportMock.onMapImageryChanged.raiseEvent({} as any);

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
    const customDataset: coreFrontend.MapLayerSources[] = [...sourceDataset, sourceDataset[0]];
    sandbox.stub(MapLayerPreferences, "getSources").callsFake(async function ( _iTwinId: GuidString, _iModelId?: GuidString) {
      return customDataset.map((source: any)=> coreFrontend.MapLayerSource.fromJSON(source)!);
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
      MapLayerPreferences.onLayerSourceChanged.raiseEvent(MapLayerSourceChangeType.Removed, coreFrontend.MapLayerSource.fromJSON(sourceDataset[0]));
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
        coreFrontend.MapLayerSource.fromJSON(sourceDataset[0]),
        coreFrontend.MapLayerSource.fromJSON({...sourceDataset[0], name: renamedName}));
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
        coreFrontend.MapLayerSource.fromJSON(newSourceProps) );
    });
  });

});
