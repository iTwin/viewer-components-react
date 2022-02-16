/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

/** @packageDocumentation
 * @module Tools
 */
import * as React from "react";

import { ToolbarPopupContext } from "@itwin/components-react";
import { CustomItemDef } from "@itwin/appui-react";
import { GeoAddressSearch } from "./components/GeoAddressSearch";
import { SvgGeosearch } from "@itwin/itwinui-icons-react";

/** Utility Class that provides definitions of tools. These definitions can be used to populate the UI.
 * @public
 */
// istanbul ignore next
export class GeoToolsItemDef {
  public static get geoAddressSearchButtonItemDef() {
    return new CustomItemDef({
      customId: "geo-tools:geoAddressSearch",
      iconSpec: <SvgGeosearch />,
      labelKey: "GeoTools:geoAddressSearch.label",
      popupPanelNode: (
        <ToolbarPopupContext.Consumer>
          {() => <GeoAddressSearch />}
        </ToolbarPopupContext.Consumer>
      ),
    });
  }
}
