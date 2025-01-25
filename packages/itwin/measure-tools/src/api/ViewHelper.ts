/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import type { Point3d, Ray3d } from "@itwin/core-geometry";
import type { Viewport, ViewRect } from "@itwin/core-frontend";
import { DrawingViewState, SheetViewState, SpatialViewState } from "@itwin/core-frontend";
import { WellKnownViewType } from "./MeasurementEnums.js";
import { MeasurementViewTarget } from "./MeasurementViewTarget.js";

/**
 * Helper methods for working with views.
 */
export class ViewHelper {
  /** Checks if the viewport is classified as a XSection view. */
  public static isCrossSectionView(vp: Viewport): boolean {
    return MeasurementViewTarget.classifyViewport(vp) === WellKnownViewType.XSection;
  }

  /** Checks if the viewport is classified as a Profile view */
  public static isProfileView(vp: Viewport): boolean {
    return MeasurementViewTarget.classifyViewport(vp) === WellKnownViewType.Profile;
  }

  /** Checks if the viewport is a sheet view. */
  public static isSheetView(vp: Viewport): boolean {
    return vp.view instanceof SheetViewState;
  }

  /** Checks if the viewport is any section view */
  public static isSection(vp: Viewport): boolean {
    return ViewHelper.isCrossSectionView(vp) || ViewHelper.isProfileView(vp) || ViewHelper.isSheetView(vp);
  }

  /** Checks if the viewport is a 3D view (spatial) */
  public static is3DView(vp: Viewport): boolean {
    return vp.view instanceof SpatialViewState;
  }

  /** Checks if the viewport is a 2D view (drawing) */
  public static is2DView(vp: Viewport): boolean {
    return vp.view instanceof DrawingViewState;
  }

  /** Given a ray in view coordinates, returns the intersection that is closest to the view rect.
   * Each pair of corners of the ViewRect defines an infinite plane in 2D
   * * Note: using Ray3d/Point3d for convenience only
   */
  public static closestIntersectionWithViewPlanes(rect: ViewRect, viewRay: Ray3d): Point3d | undefined {

    let xScale: number | undefined;
    let yScale: number | undefined;

    if (0.0 !== viewRay.direction.x) {
      const scale0 = (0.0 - viewRay.origin.x) / viewRay.direction.x;
      const scale1 = (rect.width - viewRay.origin.x) / viewRay.direction.x;
      if (scale0 > scale1 && scale0 >= 0.0)
        xScale = scale0;
      else if (scale1 > scale0 && scale1 >= 0.0)
        xScale = scale1;
    }
    if (0.0 !== viewRay.direction.y) {
      const scale0 = (0.0 - viewRay.origin.y) / viewRay.direction.y;
      const scale1 = (rect.height - viewRay.origin.y) / viewRay.direction.y;
      if (scale0 > scale1 && scale0 >= 0.0)
        yScale = scale0;
      else if (scale1 > scale0 && scale1 >= 0.0)
        yScale = scale1;
    }

    const xPoint = undefined === xScale ? undefined : viewRay.origin.plusScaled(viewRay.direction, xScale);
    const yPoint = undefined === yScale ? undefined : viewRay.origin.plusScaled(viewRay.direction, yScale);

    if (!xPoint && !yPoint)
      return undefined;

    const xDiff = xPoint ? Math.abs(0.5 * rect.height - xPoint.y) : Number.MAX_VALUE;
    const yDiff = yPoint ? Math.abs(0.5 * rect.width - yPoint.x) : Number.MAX_VALUE;
    if (xDiff < yDiff)
      return xPoint;

    return yPoint;
  }
}
