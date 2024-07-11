/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { IModelConnection, Viewport } from "@itwin/core-frontend";
import { IModelApp } from "@itwin/core-frontend";
import { SheetMeasurementsHelper } from "./SheetMeasurementHelper";
import { Id64String } from "@itwin/core-bentley";

class DrawingDataCache {

  private _drawingTypeCache: Map<IModelConnection, Map<Id64String, SheetMeasurementsHelper.DrawingTypeData[]>>;

  private _viewportModelChangedListeners: Map<Viewport, () => void>;

  public constructor() {
    this._drawingTypeCache = new Map<IModelConnection, Map<Id64String, SheetMeasurementsHelper.DrawingTypeData[]>>();
    this._viewportModelChangedListeners = new Map<Viewport, () => void>();

    this.setupEvents();

    // Populate initial viewports
    for (const vp of IModelApp.viewManager)
      this.addViewport(vp);
  }

  private setupEvents() {
    // If an imodel closes, clear the cache for it
    IModelConnection.onClose.addListener((imodel) => {
      this._drawingTypeCache.delete(imodel);
    });

    // Listen for new viewports opening
    IModelApp.viewManager.onViewOpen.addListener((vp) => {
      this.addViewport(vp);
    });

    // Listen for viewports closing, this also is called when IModelApp shuts down
    IModelApp.viewManager.onViewClose.addListener((vp) => {
      this.dropViewport(vp);
    });
  }

  private addViewport(vp: Viewport) {
    vp.onViewedModelsChanged.addListener((viewport) =>{
      if (!viewport.view.isSheetView())
        return;

      void this.querySheetDrawingData(viewport.iModel, viewport.view.id);
    });
  }

  private dropViewport(vp: Viewport) {
    const listener = this._viewportModelChangedListeners.get(vp);
    if (listener) {
      listener();
      this._viewportModelChangedListeners.delete(vp);
    }
  }

  public getSheetDrawingDataForViewport(vp: Viewport): SheetMeasurementsHelper.DrawingTypeData[] | [] {
    if (!vp.view.isSheetView())
      return [];

    const cache = this._drawingTypeCache.get(vp.iModel);
    if (cache)
      return cache.get(vp.view.id) ?? [];

    return [];
  }

  public async querySheetDrawingData(imodel: IModelConnection, viewedModelID: string): Promise<ReadonlyArray<SheetMeasurementsHelper.DrawingTypeData[]>> {
    let cache = this._drawingTypeCache.get(imodel);
    if (!cache) {
      cache = new Map<Id64String, SheetMeasurementsHelper.DrawingTypeData[]>();
      this._drawingTypeCache.set(imodel, cache);
    }

    let sheetData = cache.get(viewedModelID);
    if (!sheetData) {
      sheetData = await SheetMeasurementsHelper.getSheetTypes(imodel, viewedModelID);
      cache.set(viewedModelID, sheetData);
    }

    return sheetData;
  }

}

export class DrawingDataCacheSingleton {

  private static _instance: DrawingDataCache | undefined;

  private static initialize() {
    DrawingDataCacheSingleton._instance = new DrawingDataCache();
  }

  public static getInstance(): DrawingDataCache {
    if (this._instance === undefined) {
      DrawingDataCacheSingleton.initialize();
    }
    return DrawingDataCacheSingleton._instance!;
  }

}
