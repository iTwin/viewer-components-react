/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { DecorateContext, Decorator, IModelApp, ScreenViewport } from "@itwin/core-frontend";

/** Handles forwarding a cached graphics decorate call for measurements. Note this is package internal and not meant to be exposed as public API. */
export class MeasurementCachedGraphicsHandler implements Decorator {
  private static _instance?: MeasurementCachedGraphicsHandler;

  private _onDecorateCallback?: (context: DecorateContext) => void;
  private _dropCallback?: () => void;

  public static get instance(): MeasurementCachedGraphicsHandler {
    if (!this._instance)
      this._instance = new MeasurementCachedGraphicsHandler();

    return this._instance;
  }

  public get useCachedDecorations(): true | undefined { return true; }

  public decorate(context: DecorateContext): void {
    if (this._onDecorateCallback)
      this._onDecorateCallback(context);
  }

  public setDecorateCallback(callback?: (context: DecorateContext) => void) {
    this._onDecorateCallback = callback;
  }

  public startDecorator(): void {
    if (this._dropCallback)
      return;

    this._dropCallback = IModelApp.viewManager.addDecorator(this);
  }

  public stopDecorator(): void {
    if (this._dropCallback) {
      this._dropCallback();
      this._dropCallback = undefined;
    }
  }

  public invalidateDecorations(vp?: ScreenViewport) {
    if (!vp) {
      IModelApp.viewManager.invalidateCachedDecorationsAllViews(this);
    } else {
      vp.invalidateCachedDecorations(this);
    }
  }
}
