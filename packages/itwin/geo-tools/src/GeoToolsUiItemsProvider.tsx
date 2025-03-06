/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { ToolbarItemUtilities, ToolbarOrientation, ToolbarUsage } from "@itwin/appui-react";
import type { ToolbarItem, UiItemsProvider } from "@itwin/appui-react";

import { GeoToolsItemDef } from "./GeoToolsItemDef";

export class GeoToolsAddressSearchProvider implements UiItemsProvider {
  public readonly id = "GeoToolsAddressSearchProvider";

  public getToolbarItems(): ToolbarItem[] {
    const horizontalLayoutOverride = {
      standard: {
        orientation: ToolbarOrientation.Horizontal,
        usage: ToolbarUsage.ViewNavigation,
      },
    };
    return [
      ToolbarItemUtilities.createCustomItem({
        id: GeoToolsItemDef.geoAddressSearchButtonItemDef.id,
        itemPriority: 70,
        icon: GeoToolsItemDef.geoAddressSearchButtonItemDef.iconNode,
        label: GeoToolsItemDef.geoAddressSearchButtonItemDef.label,
        panelContent: GeoToolsItemDef.geoAddressSearchButtonItemDef.panelContent,
        layouts: horizontalLayoutOverride,
      }),
    ];
  }
}
