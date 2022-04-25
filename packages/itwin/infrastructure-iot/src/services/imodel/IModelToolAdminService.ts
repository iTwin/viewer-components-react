/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { HitDetail, IModelApp, ToolAdmin } from "@itwin/core-frontend";

class IModelToolAdminServiceSingleton extends ToolAdmin {

  private tooltipOverrides: {[key: string]: HTMLElement} = {};

  public activateSelectTool(): void {
    void IModelApp.tools.run("Select");
  }

  // In "element" sensor marker mode, we override tooltips for elements with sensors to show our custom tooltip
  public override async getToolTip(hit: HitDetail): Promise<HTMLElement | string> {
    if (hit.isElementHit && this.tooltipOverrides[hit.sourceId]) {
      return this.tooltipOverrides[hit.sourceId];
    } else {
      return super.getToolTip(hit);
    }
  }

  // Override a default iModel tooltip with a custom HTML element
  public setTooltipOverride(elementId: string, tooltipElement?: HTMLElement): void {
    if (tooltipElement) {
      this.tooltipOverrides[elementId] = tooltipElement;
    } else {
      delete this.tooltipOverrides[elementId];
    }
  }
}

export const IModelToolAdminService: IModelToolAdminServiceSingleton = new IModelToolAdminServiceSingleton();
