/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
import * as moq from "typemoq";
import { BeEvent } from "@itwin/core-bentley";
import * as coreCommon from "@itwin/core-common";

import type * as coreFrontend from "@itwin/core-frontend";
/**
 * ViewportMock
 *
 *  @internal */
export class ViewportMock {
  public viewportMock = moq.Mock.ofType<coreFrontend.ScreenViewport>();
  public viewMock = moq.Mock.ofType<coreFrontend.ViewState3d>();
  public displayStyleMock = moq.Mock.ofType<coreFrontend.DisplayStyle3dState>();
  public imodelMock = moq.Mock.ofType<coreFrontend.IModelConnection>();
  public displayStyleSettingsMock = moq.Mock.ofType<coreCommon.DisplayStyle3dSettings>();
  public mapImageryMock = moq.Mock.ofType<coreCommon.MapImagerySettings>();
  public viewsFlagsMock = moq.Mock.ofType<coreCommon.ViewFlags>();
  public onMapImageryChanged: BeEvent<(newImagery: Readonly<coreCommon.MapImagerySettings>) => void> = new BeEvent<
    (newImagery: Readonly<coreCommon.MapImagerySettings>) => void
  >();

  public onDisplayStyleChanged: BeEvent<(vp: Readonly<coreFrontend.Viewport>) => void> = new BeEvent<(vp: Readonly<coreFrontend.Viewport>) => void>();

  public baseMap: coreCommon.BaseLayerSettings = coreCommon.BaseMapLayerSettings.fromJSON(
    coreCommon.BaseMapLayerSettings.fromProvider(
      coreCommon.BackgroundMapProvider.fromJSON({ name: "BingProvider", type: coreCommon.BackgroundMapType.Hybrid }),
    ),
  );

  public detachMapLayerByIndexFunc: ((mapLayerIndex: coreFrontend.MapLayerIndex) => void) | undefined;
  public backgroundLayers: coreCommon.MapLayerSettings[] = [];
  public overlayLayers: coreCommon.MapLayerSettings[] = [];
  public get object() {
    return this.viewportMock.object;
  }

  public setup() {
    this.onMapImageryChanged = new BeEvent<(newImagery: Readonly<coreCommon.MapImagerySettings>) => void>();
    this.viewsFlagsMock.setup((flags) => flags.backgroundMap).returns(() => true);
    this.mapImageryMock.setup((mapImagery) => mapImagery.backgroundBase).returns(() => this.baseMap);
    this.mapImageryMock.setup((mapImagery) => mapImagery.backgroundLayers).returns(() => this.backgroundLayers);
    this.mapImageryMock.setup((mapImagery) => mapImagery.overlayLayers).returns(() => this.overlayLayers);

    this.displayStyleSettingsMock.setup((dsSettings) => dsSettings.mapImagery).returns(() => this.mapImageryMock.object);
    // displayStyleSettingsMock.setup((dsSettings) => dsSettings.onMapImageryChanged).returns(() => new BeEvent<(newImagery: Readonly<MapImagerySettings>) => void>());
    this.displayStyleSettingsMock.setup((dsSettings) => dsSettings.onMapImageryChanged).returns(() => this.onMapImageryChanged);

    this.displayStyleMock.setup((ds) => ds.settings).returns(() => this.displayStyleSettingsMock.object);
    this.displayStyleMock.setup((ds) => ds.backgroundMapBase).returns(() => this.baseMap);

    this.displayStyleMock
      .setup((ds) => ds.changeMapLayerProps(moq.It.isAny(), moq.It.isAny()))
      .returns((props: Partial<coreCommon.MapLayerProps>, mapLayerIndex: coreFrontend.MapLayerIndex) => {
        const index = mapLayerIndex.index;
        const layers = mapLayerIndex.isOverlay ? this.overlayLayers : this.backgroundLayers;
        if (index < 0 || index >= layers.length) {
          return;
        }
        layers[index] = layers[index].clone(props);
        this.onMapImageryChanged.raiseEvent(this.mapImageryMock.object);
        this.onDisplayStyleChanged.raiseEvent(this.viewportMock.object); // Indirectly raised by Viewport.renderFrame() at runtime
      });
    this.displayStyleMock
      .setup((ds) => ds.detachMapLayerByIndex(moq.It.isAny()))
      .returns((mapLayerIndex: coreFrontend.MapLayerIndex) => {
        if (this.detachMapLayerByIndexFunc) {
          this.detachMapLayerByIndexFunc(mapLayerIndex);
        }

        // Not too sure about this one, but
        this.onMapImageryChanged.raiseEvent(this.mapImageryMock.object);
      });
    this.imodelMock.setup((iModel) => iModel.iModelId).returns(() => "fakeGuid");
    this.imodelMock.setup((iModel) => iModel.iTwinId).returns(() => "fakeGuid");

    this.viewMock.setup((view) => view.iModel).returns(() => this.imodelMock.object);
    this.viewportMock.setup((viewport) => viewport.iModel).returns(() => this.viewMock.object.iModel);
    this.viewportMock.setup((viewport) => viewport.view).returns(() => this.viewMock.object);
    this.viewportMock.setup((viewport) => viewport.viewFlags).returns(() => this.viewsFlagsMock.object);
    this.viewportMock.setup((viewport) => viewport.displayStyle).returns(() => this.displayStyleMock.object);
    this.viewportMock.setup((viewport) => viewport.onDisplayStyleChanged).returns(() => this.onDisplayStyleChanged);
    this.viewportMock
      .setup((viewport) => viewport.onMapLayerScaleRangeVisibilityChanged)
      .returns(() => new BeEvent<(layerIndexes: coreFrontend.MapLayerScaleRangeVisibility[]) => void>());
  }

  public reset() {
    this.baseMap = coreCommon.BaseMapLayerSettings.fromJSON(
      coreCommon.BaseMapLayerSettings.fromProvider(
        coreCommon.BackgroundMapProvider.fromJSON({ name: "BingProvider", type: coreCommon.BackgroundMapType.Hybrid }),
      ),
    );
    this.backgroundLayers = [];
    this.viewsFlagsMock.reset();
    this.mapImageryMock.reset();
    this.displayStyleSettingsMock.reset();
    this.displayStyleMock.reset();
    this.imodelMock.reset();
    this.viewMock.reset();
    this.viewportMock.reset();
  }
}
