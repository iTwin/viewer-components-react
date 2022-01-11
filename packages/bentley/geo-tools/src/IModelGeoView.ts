/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { Range2d, Range3d } from "@bentley/geometry-core";
import { CartographicRange } from "@bentley/imodeljs-common";
import { IModelApp, ViewGlobeLocationTool } from "@bentley/imodeljs-frontend";

export class IModelGeoView {
  public static getFrustumLonLatBBox(): Range2d | undefined {
    let result: Range2d | undefined;

    const vp = IModelApp.viewManager?.selectedView;
    if (vp === undefined) {
      return result;
    }

    const view = vp.view;
    const ecef = vp.iModel.ecefLocation;
    if (!view.isSpatialView() || undefined === ecef) {
      return result;
    }

    const frustum = view.calculateFrustum();
    if (!frustum) {
      return result;
    }

    const viewRange = Range3d.createArray(frustum.points);
    const range = new CartographicRange(viewRange, ecef.getTransform());
    return range.getLongitudeLatitudeBoundingBox();
  }

  public static locateAddress(address: string): boolean {
    const vp = IModelApp.viewManager?.selectedView;
    if (vp === undefined) {
      return false;
    }

    const locationTool = new ViewGlobeLocationTool(vp);
    return locationTool.parseAndRun(address);
  }
}
