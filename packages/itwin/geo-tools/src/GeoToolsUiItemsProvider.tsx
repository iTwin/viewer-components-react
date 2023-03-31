/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { StageUsage, ToolbarHelper, ToolbarOrientation, ToolbarUsage, UiItemsProvider } from "@itwin/appui-react";

import { GeoToolsItemDef } from "./GeoToolsItemDef";

export class GeoToolsAddressSearchProvider implements UiItemsProvider {
  public readonly id = "GeoToolsAddressSearchProvider";

  public  provideToolbarItems(
    _stageId: string,
    stageUsage: string,
    toolbarUsage: ToolbarUsage,
    toolbarOrientation: ToolbarOrientation
  ) {
    if (
      stageUsage === StageUsage.General &&
      toolbarUsage === ToolbarUsage.ViewNavigation &&
      toolbarOrientation === ToolbarOrientation.Horizontal
    ) {
      return [
        ToolbarHelper.createToolbarItemFromItemDef(
          70,
          GeoToolsItemDef.geoAddressSearchButtonItemDef,
        ),
      ];
    }

    return [];
  }
}
