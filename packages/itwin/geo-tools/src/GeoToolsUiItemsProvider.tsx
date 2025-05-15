/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { ToolbarItemUtilities, ToolbarOrientation, ToolbarUsage } from "@itwin/appui-react";
import { GeoToolsItemDef } from "./GeoToolsItemDef";

import type { GeoToolsOptions } from "./GeoToolsItemDef";
import type { ToolbarItem, UiItemsProvider } from "@itwin/appui-react";

import type { AddressProvider } from "./AddressProvider";

export class GeoToolsAddressSearchProvider implements UiItemsProvider {
  public readonly id = "GeoToolsAddressSearchProvider";
  private _opts?: GeoToolsOptions;


  public constructor(opts?: GeoToolsOptions) {
    this._opts = opts;
  }

  public getToolbarItems(): ToolbarItem[] {
    const horizontalLayoutOverride = {
      standard: {
        orientation: ToolbarOrientation.Horizontal,
        usage: ToolbarUsage.ViewNavigation,
      },
    };

    const itemDef = GeoToolsItemDef.getItemDef(this._opts);
    return [
      ToolbarItemUtilities.createCustomItem({
        id: itemDef.id,
        itemPriority: 70,
        icon: itemDef.iconNode,
        label: itemDef.label,
        panelContent: itemDef.panelContent,
        layouts: horizontalLayoutOverride,
      }),
    ];
  }
}
