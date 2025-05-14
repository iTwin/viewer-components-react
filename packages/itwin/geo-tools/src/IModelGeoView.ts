/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { CartographicRange } from "@itwin/core-common";
import { IModelApp, MapCartoRectangle, ViewGlobeLocationTool } from "@itwin/core-frontend";
import { Range3d } from "@itwin/core-geometry";

import type { Range2d} from "@itwin/core-geometry";
import type { Cartographic} from "@itwin/core-common";
export class IModelGeoView {
  public static getFrustumLonLatBBox(): MapCartoRectangle | undefined {
    const vp = IModelApp.viewManager?.selectedView;
    if (vp === undefined) {
      return undefined;
    }

    const view = vp.view;
    const ecef = vp.iModel.ecefLocation;
    if (!view.isSpatialView() || undefined === ecef) {
      return undefined;
    }

    const frustum = view.calculateFrustum();
    if (!frustum) {
      return undefined;
    }

    const viewRange = Range3d.createArray(frustum.points);
    const range = new CartographicRange(viewRange, ecef.getTransform());
    const latLongBBox =  range.getLongitudeLatitudeBoundingBox();
    return MapCartoRectangle.fromRadians(latLongBBox.low.x, latLongBBox.low.y, latLongBBox.high.x, latLongBBox.high.y);

  }

  public static async locateAddress(address: string): Promise<boolean> {
    const vp = IModelApp.viewManager?.selectedView;
    if (vp === undefined) {
      return Promise.resolve(false);
    }

    const locationTool = new ViewGlobeLocationTool(vp);
    return locationTool.parseAndRun(address);
  }

  public static async locatePosition(carto: Cartographic): Promise<boolean> {
    const vp = IModelApp.viewManager?.selectedView;
    if (vp === undefined) {
      return Promise.resolve(false);
    }

    const locationTool = new ViewGlobeLocationTool(vp);

    return locationTool.parseAndRun(`${carto.latitudeDegrees}`, `${carto.longitudeDegrees}`);
  }
}
