/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import type { IModelConnection } from "@itwin/core-frontend";
import { IModelApp } from "@itwin/core-frontend";
import { SheetMeasurementsHelper } from "./SheetMeasurementHelper";

class DrawingDataCache {

  // Goes from viewed model to drawing types
  private _drawingTypeCache: Map<string, SheetMeasurementsHelper.DrawingTypeData[]>;

  private _sheetChangeListener: VoidFunction[] = [];

  public getDrawingtypes(viewedModelID: string): Readonly<SheetMeasurementsHelper.DrawingTypeData[]> {
    const result = this._drawingTypeCache.get(viewedModelID);
    return result ?? [];
  }

  public constructor(imodel: IModelConnection) {
    this._drawingTypeCache = new Map<string, SheetMeasurementsHelper.DrawingTypeData[]>();
    try {
      void this.updateDrawingTypeCache(imodel);
    } catch (e) {
      console.warn("DrawingTypeDataCache could not be initialized");
    }
  }

  public destructor() {
    this.clearListeners();
    this._drawingTypeCache.clear();
  }

  private clearListeners() {
    this._sheetChangeListener.forEach((func) => {
      func();
    });
    this._sheetChangeListener = [];
  }

  private async updateDrawingTypeCache(iModel: IModelConnection) {
    this.clearListeners();

    const sheetIds = new Set<string>();

    for (const viewport of IModelApp.viewManager) {
      this._sheetChangeListener.push(viewport.onViewedModelsChanged.addListener(async () => this.updateDrawingTypeCache(iModel)));
      if (viewport.view.isSheetView()) {
        if (!this._drawingTypeCache.has(viewport.view.id))
          sheetIds.add(viewport.view.id);
      }
    }

    for (const id of sheetIds) {
      this._drawingTypeCache.set(id, await SheetMeasurementsHelper.getSheetTypes(iModel, id));
    }
  }

}

export class DrawingDataCacheSingleton {

  private static _instance: DrawingDataCache | undefined;
  private static _onImodelClose: () => void;

  public static initialize(imodel: IModelConnection) {
    DrawingDataCacheSingleton._instance = new DrawingDataCache(imodel);
    DrawingDataCacheSingleton._onImodelClose = imodel.onClose.addListener(() => {
      DrawingDataCacheSingleton._instance?.destructor();
      DrawingDataCacheSingleton._instance = undefined;
      DrawingDataCacheSingleton._onImodelClose();
    })
  }

  public static getDrawingtypes(viewedModelID: string): Readonly<SheetMeasurementsHelper.DrawingTypeData[]> {
    return DrawingDataCacheSingleton._instance?.getDrawingtypes(viewedModelID) ?? [];
  }

}
