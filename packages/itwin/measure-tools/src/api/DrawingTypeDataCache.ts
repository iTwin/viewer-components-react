/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import type { IModelConnection } from "@itwin/core-frontend";
import { IModelApp } from "@itwin/core-frontend";
import { SheetMeasurementsHelper } from "./SheetMeasurementHelper";

export class DrawingDataCache {

  private _drawingTypeCache: SheetMeasurementsHelper.DrawingTypeData[];
  private _sheetChangeListener: VoidFunction[] = [];

  public get drawingtypes(): ReadonlyArray<SheetMeasurementsHelper.DrawingTypeData> {
    return this._drawingTypeCache;
  }

  public constructor() {
    this._drawingTypeCache = [];
  }

  public async updateDrawingTypeCache(iModel: IModelConnection) {
    this._sheetChangeListener.forEach((func) => {
      func();
    });
    this._sheetChangeListener = [];
    this._drawingTypeCache = [];

    const sheetIds = new Set<string>();

    for (const viewport of IModelApp.viewManager) {
      if (viewport.view.isSheetView()) {
        this._sheetChangeListener.push(viewport.onViewedModelsChanged.addListener(async () => this.updateDrawingTypeCache(iModel)));
        sheetIds.add(viewport.view.id);
      }
    }

    for (const id of sheetIds) {
      this._drawingTypeCache = this._drawingTypeCache.concat(await SheetMeasurementsHelper.getSheetTypes(iModel, id));
    }
  }

}
