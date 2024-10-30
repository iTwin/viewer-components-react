/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { ColorDef, QueryBinder } from "@itwin/core-common";
import type { BeButtonEvent, DecorateContext, GraphicBuilder, HitDetail, IModelConnection, ScreenViewport } from "@itwin/core-frontend";
import { GraphicType, IModelApp } from "@itwin/core-frontend";
import { Point3d } from "@itwin/core-geometry";
import { Transform } from "@itwin/core-geometry";
import { Point2d } from "@itwin/core-geometry";
import type { DrawingMetadata } from "./Measurement";
import { DrawingDataCache } from "./DrawingTypeDataCache";

export namespace SheetMeasurementsHelper {

  /** This maps directly to the viewType field found in the schema on BisCore.viewAttachment */
  export enum DrawingType {
    CrossSection = 3,
    Profile = 5,
    Plan = 6
  }

  /**
   * Used as parameter for measurement transform operation which is a 3 step process
   */
  export interface SheetTransformParams {
    masterOrigin: Point3d;
    sheetTov8Drawing: Transform;
    v8DrawingToDesign: Transform;
  }

  export interface DrawingTypeData {
    origin: Point2d;
    extents: Point2d;
    type: DrawingType;
  }

  /**
   * @param imodel
   * @param id SheetViewDefinition ID
   * @param mousePos position of the mouse click
   * @returns Drawing metadata
   */
  export async function getDrawingId(imodel: IModelConnection, id: string, mousePos: Point3d): Promise<DrawingMetadata | undefined> {
    const { ecsql, parameters } = getDrawingInfoECSQL(id);

    if (imodel.isBlank) {
      return undefined;
    }

    const iter = imodel.createQueryReader(ecsql, QueryBinder.from(parameters));

    for await (const row of iter) {
      const x = mousePos.x;
      const y = mousePos.y;
      const highX = row[3].X - row[2].X;
      const highY = row[3].Y - row[2].Y;
      if (x >= row[1].X && x <= row[1].X + highX) {
        // Within x extents
        if (y >= row[1].Y && y <= row[1].Y + highY) {
          // Within y extents
          const jsonProp = JSON.parse(row[4]);
          const scale = jsonProp.scale;
          if (jsonProp.civilimodelconn) {
            const sheetToProfileTransform = Transform.fromJSON(jsonProp.civilimodelconn.sheetToProfileTransform);
            const sheetToWorldTransform: SheetTransformParams = { masterOrigin: Point3d.fromJSON(jsonProp.civilimodelconn.masterOrigin), sheetTov8Drawing: Transform.fromJSON(jsonProp.civilimodelconn.sheetToV8DrawingTransform), v8DrawingToDesign: Transform.fromJSON(jsonProp.civilimodelconn.v8DrawingToDesignTransform)};
            const result: DrawingMetadata = {
              drawingId: row[0],
              origin: new Point2d(row[1].X, row[1].Y),
              extents: new Point2d(highX, highY),
              worldScale: scale,
              sheetToWorldTransform,
              sheetToProfileTransform,
            };
            return result;
          }
        }
      }
    }
    // Not in any drawing
    return undefined;
  }

  function getDrawingInfoECSQL(id: string) {
    const ecsql = "SELECT [d].ECInstanceId, \
      [va].origin, \
      [va].BBoxLow, \
      [va].BBoxHigh, \
      [va].JsonProperties \
      FROM Biscore.sheetViewDefinition [svd], Biscore.sheet [s], Biscore.viewAttachment [va], Biscore.DrawingViewDefinition [dvd], Biscore.drawing [d] \
      WHERE [svd].ECInstanceId =:[id] \
      AND [svd].basemodel.id = [s].EcInstanceId \
      AND [s].ECInstanceId = [va].model.id \
      AND [va].view.id = [dvd].ECInstanceId \
      AND [dvd].baseModel.id = [d].ECInstanceId";

    return { ecsql, parameters: { id }};
  }

  export function checkIfInDrawing(point: Point3d, drawingOrigin: Point2d, drawingExtents: Point2d): boolean {
    return (point.x >= drawingOrigin.x && point.x <= drawingExtents.x + drawingOrigin.x && point.y >= drawingOrigin.y && point.y <= drawingExtents.y + drawingOrigin.y);
  }

  export function getDrawingContourGraphic(context: DecorateContext, origin: Point2d, extents: Point2d): GraphicBuilder {
    const areaBuilder = context.createGraphicBuilder(GraphicType.WorldOverlay);
    const left = origin.x;
    const right = origin.x + extents.x;
    const up = origin.y + extents.y;
    const down = origin.y;
    areaBuilder.setSymbology(ColorDef.from(148, 190, 250), ColorDef.from(148, 190, 250), 2);
    areaBuilder.addLineString2d([origin, new Point2d(right, down), new Point2d(right, up), new Point2d(left, up), origin], 0);
    return areaBuilder;
  }

  /**
   * Uses drawing metaData to transform a point from sheet coordinates to 3d world coordinates
   * @param point In sheet coordinates
   * @param transform
   * @returns Point in world coordinates
   */
  export function measurementTransform(point: Point3d, transform: SheetTransformParams): Point3d {
    const drawingPoint = transform.sheetTov8Drawing.multiplyPoint3d(point);
    const adjustedDrawingPoint = new Point3d(drawingPoint.x, drawingPoint.y, transform.masterOrigin.z);
    const final3dPoint = transform.v8DrawingToDesign.multiplyPoint3d(adjustedDrawingPoint);
    return final3dPoint;
  }

  export async function getSheetTypes(imodel: IModelConnection, id: string): Promise<DrawingTypeData[]> {
    const { ecsql, parameters } = getDrawingInfoECSQL(id);

    if (imodel.isBlank) {
      return [];
    }

    const iter = imodel.createQueryReader(ecsql, QueryBinder.from(parameters));

    const result = [];

    for await (const row of iter) {
      const highX = row[3].X - row[2].X;
      const highY = row[3].Y - row[2].Y;
      const jsonProp = JSON.parse(row[4]);
      if (jsonProp.civilimodelconn) {
        const origin = new Point2d(row[1].X, row[1].Y);
        const extents = new Point2d(highX, highY);
        const viewType = jsonProp.civilimodelconn.viewType;
        result.push({origin, extents, type: viewType});
      }
    }

    return result;
  }

  /**
   * Checks if the drawing pointed by the event is allowed according to the provided drawing types
   * Will return true if no drawing detected
   * @param ev
   * @param allowedDrawingTypes
   * @returns
   */
  export function checkIfAllowedDrawingType(viewport: ScreenViewport | undefined, point: Point3d, allowedDrawingTypes: DrawingType[]) {
    if (!viewport)
      return false;
    for (const drawing of DrawingDataCache.getInstance().getSheetDrawingDataForViewport(viewport)) {
      if (allowedDrawingTypes.includes(drawing.type)) {
        if (SheetMeasurementsHelper.checkIfInDrawing(point, drawing.origin, drawing.extents)) {
          return true;
        }
      }
    }
    return false;
  }

  function getNameFromDrawingType(type: SheetMeasurementsHelper.DrawingType): string  {
    if (type === SheetMeasurementsHelper.DrawingType.CrossSection) {
      return IModelApp.localization.getLocalizedString("CivilReviewTools:SheetMeasurementTooltip.MeasurementNames.CrossSection");
    } else if (type === SheetMeasurementsHelper.DrawingType.Plan) {
      return IModelApp.localization.getLocalizedString("CivilReviewTools:SheetMeasurementTooltip.MeasurementNames.Plan");
    } else if (type === SheetMeasurementsHelper.DrawingType.Profile) {
      return IModelApp.localization.getLocalizedString("CivilReviewTools:SheetMeasurementTooltip.MeasurementNames.Profile");
    } else {
      return "";
    }
  }

  export async function getSheetToolTipText(hit: HitDetail, allowedDrawingTypesList: SheetMeasurementsHelper.DrawingType[], defaultToolTip:(hit: HitDetail) => Promise<HTMLElement | string>): Promise<string | HTMLElement> {
    if (SheetMeasurementsHelper.checkIfAllowedDrawingType(hit.viewport, hit.hitPoint, allowedDrawingTypesList)) {
      return defaultToolTip(hit);
    }

    if (allowedDrawingTypesList.length < 1) {
      return IModelApp.localization.getLocalizedString("CivilReviewTools:SheetMeasurementTooltip.NoAllowedDrawingTypes");;
    }
    if (allowedDrawingTypesList.length > 1){
      let result = IModelApp.localization.getLocalizedString("CivilReviewTools:SheetMeasurementTooltip.MoreMeasurementsInvalidHead", { drawingName: getNameFromDrawingType(allowedDrawingTypesList[0])});
      for (let i = 1; i < allowedDrawingTypesList.length - 1; i++) {
        result = result + IModelApp.localization.getLocalizedString("CivilReviewTools:SheetMeasurementTooltip.MoreMeasurementsInvalidMiddle", { drawingName: getNameFromDrawingType(allowedDrawingTypesList[i])});
      }
      result = result + IModelApp.localization.getLocalizedString("CivilReviewTools:SheetMeasurementTooltip.MoreMeasurementsInvalidLast", { drawingName: getNameFromDrawingType(allowedDrawingTypesList[allowedDrawingTypesList.length - 1])});
      return result;
    }
    return IModelApp.localization.getLocalizedString("CivilReviewTools:SheetMeasurementTooltip.OneMeasurementInvalid", { drawingName: getNameFromDrawingType(allowedDrawingTypesList[0])});
  }
}
