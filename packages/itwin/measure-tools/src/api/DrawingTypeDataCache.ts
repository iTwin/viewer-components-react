/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import type { Viewport } from "@itwin/core-frontend";
import { IModelConnection } from "@itwin/core-frontend";
import { IModelApp } from "@itwin/core-frontend";
import type { Id64String } from "@itwin/core-bentley";
import { SheetMeasurementHelper } from "./SheetMeasurementHelper.js";

export class DrawingDataCache {

  private _drawingDataCache: Map<IModelConnection, Map<Id64String, SheetMeasurementHelper.DrawingTypeData[]>>;
  private _drawingTypeDataCache: Map<IModelConnection, Map<Id64String, number>>;
  private _viewportModelChangedListeners: Map<Viewport, () => void>;
  private static _instance: DrawingDataCache | undefined;

  private constructor() {
    this._drawingDataCache = new Map<IModelConnection, Map<Id64String, SheetMeasurementHelper.DrawingTypeData[]>>();
    this._drawingTypeDataCache = new Map<IModelConnection, Map<Id64String, number>>();
    this._viewportModelChangedListeners = new Map<Viewport, () => void>();

    this.setupEvents();

    // Populate initial viewports
    for (const vp of IModelApp.viewManager)
      this.addViewport(vp);
  }

  public static getInstance(): DrawingDataCache {
    if (DrawingDataCache._instance === undefined) {
       DrawingDataCache._instance = new DrawingDataCache();
    }
    return DrawingDataCache._instance;
  }

  private setupEvents() {
    // If an imodel closes, clear the cache for it
    IModelConnection.onClose.addListener((imodel) => {
      this._drawingDataCache.delete(imodel);
      this._drawingTypeDataCache.delete(imodel);
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

  public getSheetDrawingDataForViewport(vp: Viewport): ReadonlyArray<SheetMeasurementHelper.DrawingTypeData> {
    if (!vp.view.isSheetView())
      return [];

    const cache = this._drawingDataCache.get(vp.iModel);
    if (cache)
      return cache.get(vp.view.id) ?? [];

    return [];
  }

  public async queryDrawingType(imodel: IModelConnection, drawingId: string) {
    let cache = this._drawingTypeDataCache.get(imodel);

    if (!cache) {
      cache = new Map<Id64String, number>();
      this._drawingTypeDataCache.set(imodel, cache);
    }

    let drawingType = cache?.get(drawingId);

    if (!drawingType) {
      this._drawingTypeDataCache.set(imodel, await SheetMeasurementHelper.getDrawingsTypes(imodel));
      drawingType = this._drawingTypeDataCache.get(imodel)?.get(drawingId);
    }

    return drawingType;
  }

  public async querySheetDrawingData(imodel: IModelConnection, viewedModelID: string): Promise<SheetMeasurementHelper.DrawingTypeData[]> {
    let cache = this._drawingDataCache.get(imodel);
    if (!cache) {
      cache = new Map<Id64String, SheetMeasurementHelper.DrawingTypeData[]>();
      this._drawingDataCache.set(imodel, cache);
    }

    let sheetData = cache.get(viewedModelID);
    if (!sheetData) {
      sheetData = await SheetMeasurementHelper.getDrawingInfo(imodel, viewedModelID);
      cache.set(viewedModelID, sheetData);
    }

    return sheetData;
  }

}
