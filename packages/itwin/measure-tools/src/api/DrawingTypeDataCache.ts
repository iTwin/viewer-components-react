/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import type { IModelConnection } from "@itwin/core-frontend";
import { IModelApp } from "@itwin/core-frontend";
import { SheetMeasurementsHelper } from "./SheetMeasurementHelper";

export class DrawingDataCache {

  // Goes from viewed model to drawing types
  private _drawingTypeCache: Map<string, SheetMeasurementsHelper.DrawingTypeData[]>;

  private _sheetChangeListener: VoidFunction[] = [];

  public getDrawingtypes(viewedModelID: string): Readonly<SheetMeasurementsHelper.DrawingTypeData[]> {
    const result = this._drawingTypeCache.get(viewedModelID);
    return result ?? [];
  }

  public constructor(imodel: IModelConnection) {
    this._drawingTypeCache = new Map<string, SheetMeasurementsHelper.DrawingTypeData[]>();
    this.updateDrawingTypeCache(imodel);
  }

  private async updateDrawingTypeCache(iModel: IModelConnection) {
    this._sheetChangeListener.forEach((func) => {
      func();
    });
    this._sheetChangeListener = [];

    const sheetIds = new Set<string>();

    for (const viewport of IModelApp.viewManager) {
      if (viewport.view.isSheetView()) {
        this._sheetChangeListener.push(viewport.onViewedModelsChanged.addListener(async () => this.updateDrawingTypeCache(iModel)));
        if (!this._drawingTypeCache.has(viewport.view.id))
          sheetIds.add(viewport.view.id);
      }
    }

    for (const id of sheetIds) {
      this._drawingTypeCache.set(id, await SheetMeasurementsHelper.getSheetTypes(iModel, id));
    }
  }

}
