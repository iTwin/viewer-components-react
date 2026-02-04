/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { OptionItemHandler } from "./OptionItemHandler";
import type { StoryClipPlanesProvider } from "../FunctionalityProviders/StoryClipPlanesProvider";
import { SectioningUtil } from "../visibility/SectioningUtil";

export class LabelHandler extends OptionItemHandler {
  private static readonly SPACE_LABEL_STORAGE_KEY = "story-show-space-label";
  private clipSectionProvider: StoryClipPlanesProvider;
  constructor(clipSectionProvider: StoryClipPlanesProvider, key: string, label: string, toolIcon: string) {
    super(key, label, toolIcon);
    this.clipSectionProvider = clipSectionProvider;
    this.clipSectionProvider.showSpaceLabels = sessionStorage.getItem(LabelHandler.SPACE_LABEL_STORAGE_KEY) === "true";
    SectioningUtil.setSpaceLabelVisible(this.clipSectionProvider.showSpaceLabels);
  }
  public toggle() {
    this.clipSectionProvider.showSpaceLabels = !this.clipSectionProvider.showSpaceLabels;
    sessionStorage.setItem(LabelHandler.SPACE_LABEL_STORAGE_KEY, String(this.clipSectionProvider.showSpaceLabels));
    SectioningUtil.setSpaceLabelVisible(this.clipSectionProvider.showSpaceLabels);
  }
  public getIsActive(): boolean {
    return this.clipSectionProvider.showSpaceLabels;
  }
}
