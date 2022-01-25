/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { OptionItemHandler } from "./OptionItemHandler";
import type { StoryClipPlanesProvider } from "../FunctionalityProviders/StoryClipPlanesProvider";

export class ClipAtSpacesHandler extends OptionItemHandler {
  private static readonly CLIP_AT_SPACE_STORAGE_KEY = "clip-at-space";
  private _clipSectionProvider: StoryClipPlanesProvider;

  constructor(clipSectionProvider: StoryClipPlanesProvider, clipAtSpaces: boolean, key: string, label: string, toolIcon: string) {
    super(key, label, toolIcon);
    this._clipSectionProvider = clipSectionProvider;
    this._clipSectionProvider.clipAtSpaces = sessionStorage.getItem(ClipAtSpacesHandler.CLIP_AT_SPACE_STORAGE_KEY) === null ? clipAtSpaces : sessionStorage.getItem(ClipAtSpacesHandler.CLIP_AT_SPACE_STORAGE_KEY) === "true";
  }
  public toggle() {
    this._clipSectionProvider.clipAtSpaces = !this._clipSectionProvider.clipAtSpaces;
    sessionStorage.setItem(ClipAtSpacesHandler.CLIP_AT_SPACE_STORAGE_KEY, String(this._clipSectionProvider.clipAtSpaces));
  }
  public getIsActive(): boolean {
    return this._clipSectionProvider.clipAtSpaces === undefined ? false : this._clipSectionProvider.clipAtSpaces;
  }
}
