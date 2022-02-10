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
import geoSearchSvg from "./icons/geosearch.svg?sprite";
import { IconSpecUtilities } from "@itwin/appui-abstract";

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

    });
  }
}
