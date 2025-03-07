/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

/** @packageDocumentation
 * @module Tools
 */
import * as React from "react";

import type { ToolbarCustomItem} from "@itwin/appui-react";
import { ToolbarItemUtilities } from "@itwin/appui-react";
import { GeoAddressSearch } from "./components/GeoAddressSearch";
import { SvgGeosearch } from "@itwin/itwinui-icons-react";
import { GeoTools } from "./GeoTools";

/** Utility Class that provides definitions of tools. These definitions can be used to populate the UI.
 * @public
 */
// istanbul ignore next
export class GeoToolsItemDef {
  public static get geoAddressSearchButtonItemDef(): ToolbarCustomItem {
    return ToolbarItemUtilities.createCustomItem({
      id: "geo-tools:geoAddressSearch",
      icon: <SvgGeosearch />,
      label: GeoTools.translate("geoAddressSearch.label"),
      panelContent: <GeoAddressSearch />,
    });
  }
}
