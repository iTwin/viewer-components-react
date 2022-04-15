/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { OptionItemHandler } from "./OptionItemHandler";
import type { ToggledTopFitViewFunctionalityProvider } from "../FunctionalityProviders/ToggledTopFitViewFunctionalityProvider";

export class TopViewHandler extends OptionItemHandler {
  private static readonly TOP_VIEW_STORAGE_KEY = "top-view-storage-key";
  private _toggledTopFitViewFunctionalityProviders: ToggledTopFitViewFunctionalityProvider[];
  private _flipToTopView: boolean;

  constructor(toggledTopFitViewFunctionalityProvider: ToggledTopFitViewFunctionalityProvider[], key: string, label: string, toolIcon: string) {
    super(key, label, toolIcon);
    this._toggledTopFitViewFunctionalityProviders = toggledTopFitViewFunctionalityProvider;
    this._flipToTopView = sessionStorage.getItem(TopViewHandler.TOP_VIEW_STORAGE_KEY) === "true";
    this.setTopViewForProviders();
  }
  public toggle() {
    this._flipToTopView = !this._flipToTopView;
    sessionStorage.setItem(TopViewHandler.TOP_VIEW_STORAGE_KEY, String(this._flipToTopView));
    this.setTopViewForProviders();
  }
  public getIsActive(): boolean {
    return this._flipToTopView;
  }

  private setTopViewForProviders() {
    this._toggledTopFitViewFunctionalityProviders.forEach((provider) => {
      provider.setTopView(this._flipToTopView);
    });
  }
}
