/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See COPYRIGHT.md in the repository root for full copyright notice.
*--------------------------------------------------------------------------------------------*/

/** @packageDocumentation
 * @module Tools
 */
import * as React from "react";

import { ToolbarPopupContext } from "@bentley/ui-components";
import { CustomItemDef, PopupButton } from "@bentley/ui-framework";
import { GeoAddressSearch } from "./components/GeoAddressSearch";
import geoSearchSvg from "./icons/geosearch.svg?sprite";
import { IconSpecUtilities } from "@bentley/ui-abstract";

/* eslint-disable deprecation/deprecation */

/** Utility Class that provides definitions of tools. These definitions can be used to populate the UI.
 * @public
 */
// istanbul ignore next
export class GeoToolsItemDef {
  public static iconSpec = IconSpecUtilities.createSvgIconSpec(geoSearchSvg);

  public static get geoAddressSearchButtonItemDef() {
    return new CustomItemDef({
      customId: "geo-tools:geoAddressSearch",
      iconSpec: GeoToolsItemDef.iconSpec,
      labelKey: "GeoTools:geoAddressSearch.label",
      popupPanelNode: <ToolbarPopupContext.Consumer>
        {() => (
          <GeoAddressSearch />
        )}
      </ToolbarPopupContext.Consumer>,
      // DEPRECATED way (still used by DR)
      reactElement: (
        <PopupButton iconSpec={GeoToolsItemDef.iconSpec} labelKey="GeoTools:geoAddressSearch.label">
          <GeoAddressSearch />
        </PopupButton>
      ),
    });
  }
}
