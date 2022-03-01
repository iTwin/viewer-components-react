import type {
  CommonToolbarItem,
  UiItemsProvider,
} from "@itwin/appui-abstract";
import {
  StageUsage,
  ToolbarOrientation,
  ToolbarUsage,
} from "@itwin/appui-abstract";
import { ToolbarHelper } from "@itwin/appui-react";

import { GeoToolsItemDef } from "./GeoToolsItemDef";

export class GeoToolsAddressSearchProvider implements UiItemsProvider {
  public readonly id = "GeoToolsAddressSearchProvider";

  public provideToolbarButtonItems(
    _stageId: string,
    stageUsage: string,
    toolbarUsage: ToolbarUsage,
    toolbarOrientation: ToolbarOrientation
  ): CommonToolbarItem[] {
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
