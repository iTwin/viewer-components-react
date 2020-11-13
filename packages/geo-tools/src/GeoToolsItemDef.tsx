/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

/** @packageDocumentation
 * @module Tools
 */
import * as React from "react";

import { ToolbarPopupContext } from "@bentley/ui-components";
import { CustomItemDef, PopupButton } from "@bentley/ui-framework";
import { GeoAddressSearch } from "./components/GeoAddressSearch";

/* eslint-disable deprecation/deprecation */

/** Utility Class that provides definitions of tools. These definitions can be used to populate the UI.
 * @public
 */
// istanbul ignore next
export class GeoToolsItemDef {
  public static get geoAddressSearchButtonItemDef() {
    return new CustomItemDef({
      customId: "geo-tools:geoAddressSearch",
      iconSpec: "icon-search",
      labelKey: "GeoTools:geoAddressSearch.label",
      popupPanelNode: <ToolbarPopupContext.Consumer>
        {() => (
          <GeoAddressSearch />
        )}
      </ToolbarPopupContext.Consumer>,
      // DEPRECATED way (still used by DR)
      reactElement: (
        <PopupButton iconSpec="icon-search" labelKey="GeoTools:geoAddressSearch.label">
          <GeoAddressSearch />
        </PopupButton>
      ),
    });
  }
}
