/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { BeEvent } from "@itwin/core-bentley";
import * as coreCommon from "@itwin/core-common";
import * as coreFrontend from "@itwin/core-frontend";
import * as moq from "typemoq";

/** @internal */
export class ViewportMock {
  public viewportMock = moq.Mock.ofType<coreFrontend.ScreenViewport>();
  public viewMock = moq.Mock.ofType<coreFrontend.ViewState3d>();
  public displayStyleMock = moq.Mock.ofType<coreFrontend.DisplayStyle3dState>();
  public imodelMock = moq.Mock.ofType<coreFrontend.IModelConnection>();
  public displayStyleSettingsMock = moq.Mock.ofType<coreCommon.DisplayStyle3dSettings>();
  public mapImageryMock = moq.Mock.ofType<coreCommon.MapImagerySettings>();
  public viewsFlagsMock = moq.Mock.ofType<coreCommon.ViewFlags>();
  public onMapImageryChanged: BeEvent<(newImagery: Readonly<coreCommon.MapImagerySettings>) => void> = new BeEvent<(newImagery: Readonly<coreCommon.MapImagerySettings>) => void>();

  public baseMap = coreCommon.BaseMapLayerSettings.fromJSON(coreCommon.BaseMapLayerSettings.fromProvider(coreCommon.BackgroundMapProvider.fromJSON({name: "BingProvider", type: coreCommon.BackgroundMapType.Hybrid} )));
  public get object() {
    return this.viewportMock.object;
  }

  public setup() {
    this.onMapImageryChanged = new BeEvent<(newImagery: Readonly<coreCommon.MapImagerySettings>) => void>();
    this.viewsFlagsMock.setup((flags) => flags.backgroundMap).returns(() => true );
    this.mapImageryMock.setup((mapImagery) => mapImagery.backgroundBase).returns(() => this.baseMap);
    this.mapImageryMock.setup((mapImagery) => mapImagery.backgroundLayers).returns(() => []);
    this.mapImageryMock.setup((mapImagery) => mapImagery.overlayLayers).returns(() => []);

    this.displayStyleSettingsMock.setup((dsSettings) => dsSettings.mapImagery).returns(() => this.mapImageryMock.object);
    // displayStyleSettingsMock.setup((dsSettings) => dsSettings.onMapImageryChanged).returns(() => new BeEvent<(newImagery: Readonly<MapImagerySettings>) => void>());
    this.displayStyleSettingsMock.setup((dsSettings) => dsSettings.onMapImageryChanged).returns(() => this.onMapImageryChanged);

    this.displayStyleMock.setup((ds) => ds.settings).returns(() => this.displayStyleSettingsMock.object);
    this.imodelMock.setup((iModel) => iModel.iModelId).returns(() => "fakeGuid");
    this.imodelMock.setup((iModel) => iModel.iTwinId).returns(() => "fakeGuid");

    this.viewMock.setup((view) => view.iModel).returns(() => this.imodelMock.object);
    this.viewportMock.setup((viewport) => viewport.iModel).returns(() => this.viewMock.object.iModel);
    this.viewportMock.setup((viewport) => viewport.view).returns(() => this.viewMock.object);
    this.viewportMock.setup((viewport) => viewport.viewFlags).returns(() => this.viewsFlagsMock.object);
    this.viewportMock.setup((viewport) => viewport.displayStyle).returns(() => this.displayStyleMock.object);
    this.viewportMock.setup((viewport) => viewport.onDisplayStyleChanged).returns(() => new BeEvent<(vp: coreFrontend.Viewport) => void>());
    this.viewportMock.setup((viewport) => viewport.onMapLayerScaleRangeVisibilityChanged).returns(() => new BeEvent<(layerIndexes: coreFrontend.MapLayerScaleRangeVisibility[]) => void>());

  }

  public reset() {
    this.baseMap = coreCommon.BaseMapLayerSettings.fromJSON(coreCommon.BaseMapLayerSettings.fromProvider(coreCommon.BackgroundMapProvider.fromJSON({name: "BingProvider", type: coreCommon.BackgroundMapType.Hybrid} )));
    this.viewsFlagsMock.reset();
    this.mapImageryMock.reset();
    this.displayStyleSettingsMock.reset();
    this.displayStyleMock.reset();
    this.imodelMock.reset();
    this.viewMock.reset();
    this.viewportMock.reset();
  }
}
