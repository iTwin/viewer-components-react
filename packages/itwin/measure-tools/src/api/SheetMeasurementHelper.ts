/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { ColorDef, QueryBinder } from "@itwin/core-common";
import type { DecorateContext, GraphicBuilder, HitDetail, ScreenViewport} from "@itwin/core-frontend";
import { GraphicType, IModelApp, type IModelConnection } from "@itwin/core-frontend";
import type { XYProps, XYZ, XYZProps} from "@itwin/core-geometry";
import { Point3d, YawPitchRollAngles } from "@itwin/core-geometry";
import { Transform } from "@itwin/core-geometry";
import { Point2d } from "@itwin/core-geometry";
import { DrawingDataCache } from "./DrawingTypeDataCache.js";
import type { DrawingMetadata } from "./Measurement.js";



export namespace SheetMeasurementHelper {

  export enum DrawingTypeEnum {
    ProfileOrElevation = 5,
    Section = 3,
    Detail = 4,
    Plan = 6
  }

  export type DrawingType = DrawingTypeEnum | SheetMeasurementsHelper.DrawingType;

  export interface SheetToWorldTransformProps {
    SVDOrigin?: XYZProps;
    SVDExtents?: XYZProps;
    SVDYaw?: number;
    SVDPitch?: number;
    SVDRoll?: number;
    sheetScale?: number;
    DVDOrigin?: XYProps;
    transformParams?: CivilSheetTransformParams;
  }

  export interface DrawingTypeData {
    id: string;
    type?: number;
    origin: { x: number, y: number}
    bBoxLow: { x: number, y: number};
    bBoxHigh: { x: number, y: number};
  }

  /** Information needed to use the old Civil transform but will eventually be removed @deprecated */
  export interface CivilSheetTransformParams {
    masterOrigin: Point3d;
    sheetTov8Drawing: Transform;
    v8DrawingToDesign: Transform;
  }

  function getSectionDrawingTypeECSQL() {
    const ecsql = "SELECT [sd].sectionType, \
    [sd].ECInstanceId \
    FROM BisCore.SectionDrawing [sd]";

    return { ecsql };
  }

  function getCivilDrawingTypeECSQL() {
    const ecsql = "SELECT [va].JsonProperties, \
      [d].EcInstanceId \
      FROM Biscore.viewAttachment [va], Biscore.drawing [d], Biscore.DrawingViewDefinition [dvd] \
      WHERE [va].view.id = [dvd].ECInstanceId \
      AND [dvd].baseModel.id = [d].ECInstanceId";

    return { ecsql };
  }

  /**
   * Get associated drawings and their position/dimensions
   * @param id ID of the sheet
   */
  function getDrawingLocationsECSQL(id: string) {
    const ecsql = "SELECT [d].ECInstanceId, \
    [va].Origin, \
    [va].BBoxLow, \
    [va].BBoxHigh \
    FROM BisCore.SheetViewDefinition [svd], \
    BisCore.ViewAttachment [va], \
    Biscore.DrawingViewDefinition [dvd], \
    Biscore.drawing [d] \
    WHERE [svd].ECInstanceId =:[id] \
    AND [svd].baseModel.id = [va].model.id \
    AND [va].view.id = [dvd].ECInstanceId \
    AND [dvd].baseModel.id = [d].ECInstanceId";

    return { ecsql, parameters: { id }};
  }

  function getSpatialViewInfoECSQL(id: string) {
    const ecsql = "SELECT [spa].Origin, \
    [spa].Extents, \
    [spa].Yaw, \
    [spa].Pitch, \
    [spa].Roll, \
    [s].scale, \
    [dvd].Origin \
    FROM BisCore.DrawingViewDefinition [dvd], \
    BisCore.SectionDrawingGeneratedFromSpatialView [sdgfsv], \
    BisCore.SpatialViewDefinition [spa], \
    BisCore.ViewAttachment [va], \
    BisCore.Sheet [s] \
    WHERE [dvd].baseModel.id =:[id] \
    AND [va].view.id = [dvd].ECInstanceId \
    AND [dvd].baseModel.id = [sdgfsv].SourceEcInstanceId \
    AND [spa].ECInstanceId = [sdgfsv].TargetEcInstanceId \
    AND [va].Model.id = [s].ECInstanceId";

    return { ecsql, parameters: { id }};
  }

  function getCivilDrawingInfoECSQL(id: string) {
    const ecsql = "SELECT [d].ECInstanceId, \
      [va].origin, \
      [va].BBoxLow, \
      [va].BBoxHigh, \
      [va].JsonProperties, \
      [s].scale \
      FROM Biscore.viewAttachment [va], Biscore.DrawingViewDefinition [dvd], Biscore.drawing [d], Biscore.Sheet [s] \
      WHERE [dvd].baseModel.id =:[id] \
      AND [va].view.id = [dvd].ECInstanceId \
      AND [dvd].baseModel.id = [d].ECInstanceId \
      AND [va].Model.id = [s].ECInstanceId";

    return { ecsql, parameters: { id }};
  }

  /**
   * Maps out the drawing types of every drawing in the imodel
   * @param imodel
   * @returns
   */
  export async function getDrawingsTypes(imodel: IModelConnection): Promise<Map<string, number>> {

    if (imodel.isBlank) {
      return new Map();
    }

    const result = new Map<string, number>();


    // Get data for Civil drawings
    const civilDrawingTypeEcsql = getCivilDrawingTypeECSQL();

    const civilReader = imodel.createQueryReader(civilDrawingTypeEcsql.ecsql);


    for await (const row of civilReader) {
      try {
        const json = JSON.parse(row[0]);
        if (json.civilimodelconn.viewType !== undefined && json.civilimodelconn.viewType !== null)
          result.set(row[1], json.civilimodelconn.viewType);
      } catch (e) {
      // Could not find civilimodelconn.viewType, (most likely because it's not a civil drawing)
      }
    }

    // Get data for section drawings
    const sectionDrawingTypeEcsql = getSectionDrawingTypeECSQL();

    const reader = imodel.createQueryReader(sectionDrawingTypeEcsql.ecsql);

    for await (const row of reader) {
      if (row[0] !== undefined && row[0] !== null)
        result.set(row[1], row[0]);
    }

    return result;
  }

  /**
   * Position and general information for every drawing in the given sheet
   * @param imodel
   * @param sheetId
   * @returns
   */
  export async function getDrawingInfo(imodel: IModelConnection, sheetId: string): Promise<DrawingTypeData[]> {

    if (imodel.isBlank) {
      return [];
    }

    const cache = DrawingDataCache.getInstance();

    const drawingEcsql = getDrawingLocationsECSQL(sheetId);

    const reader = imodel.createQueryReader(drawingEcsql.ecsql, QueryBinder.from(drawingEcsql.parameters));

    const result: DrawingTypeData[] = [];
    for await (const row of reader) {
      result.push({
        id: row[0],
        origin: { x: row[1].X, y: row[1].Y},
        bBoxLow: { x: row[2].X, y: row[2].Y },
        bBoxHigh: { x: row[3].X, y: row[3].Y },
        type: (await cache.queryDrawingType(imodel, row[0]))
      })
    }
    return result;
  }

  export function checkIfInDrawing(point: Point3d, drawingOrigin: Point2d, drawingExtents: Point2d): boolean {
    return (point.x >= drawingOrigin.x && point.x <= drawingExtents.x + drawingOrigin.x && point.y >= drawingOrigin.y && point.y <= drawingExtents.y + drawingOrigin.y);
  }

  /**
   * Gives the first drawing which constains the mouse position, undefined otherwise
   * @param mousePos
   * @param drawingInfo
   * @returns
   */
  function getCorrectDrawing(mousePos: Point3d, drawingInfo: ReadonlyArray<DrawingTypeData>): DrawingTypeData | undefined {
    const x = mousePos.x;
    const y = mousePos.y;

    for (const info of drawingInfo) {
      if (x >= info.origin.x && x <= info.origin.x + info.bBoxHigh.x) {
        // Within x extents
        if (y >= info.origin.y && y <= info.origin.y + info.bBoxHigh.y) {
          // Within y extents
          return info;
        }
      }
    }
    return undefined;
  }

  /**
   * Uses drawing metaData to transform a point from sheet coordinates to 3d world coordinates
   * @param point In sheet coordinates
   * @param transform
   * @returns Point in world coordinates
   */
  export function getCivilTransform(sheetToWorldTransform?: SheetToWorldTransformProps): Transform {
    if (sheetToWorldTransform?.transformParams?.masterOrigin === undefined ||
      sheetToWorldTransform.transformParams.sheetTov8Drawing === undefined ||
      sheetToWorldTransform.transformParams.v8DrawingToDesign === undefined
    ) {
      return Transform.createIdentity();
    }

    const transform = sheetToWorldTransform.transformParams.sheetTov8Drawing;
    transform.setMultiplyTransformTransform(Transform.createTranslation(Point3d.create(0, 0, sheetToWorldTransform.transformParams.masterOrigin.z)), transform);
    transform.setMultiplyTransformTransform(sheetToWorldTransform.transformParams.v8DrawingToDesign, transform);
    return transform;
  }

  /**
   * Main transform for drawings, takes a sheet point and transforms it to world coordinates
   * @param viewAttachmentOrigin
   * @param sheetToWorldTransform
   * @returns
   */
  export function getTransform(viewAttachmentOrigin?: XYProps, sheetToWorldTransformProps?: SheetToWorldTransformProps): Transform {

    if (viewAttachmentOrigin === undefined ||
      sheetToWorldTransformProps === undefined ||
      sheetToWorldTransformProps.DVDOrigin === undefined ||
      sheetToWorldTransformProps.SVDExtents === undefined ||
      sheetToWorldTransformProps.SVDOrigin === undefined ||
      sheetToWorldTransformProps.SVDPitch === undefined ||
      sheetToWorldTransformProps.SVDRoll === undefined ||
      sheetToWorldTransformProps.SVDYaw === undefined ||
      sheetToWorldTransformProps.sheetScale ===  undefined) {
        return getCivilTransform(sheetToWorldTransformProps);
    }

    const VAOrigin = Point2d.createZero();
    VAOrigin.setFromJSON(viewAttachmentOrigin);
    const scale = sheetToWorldTransformProps.sheetScale;
    const DVDOrigin = Point2d.createZero();
    DVDOrigin.setFromJSON(sheetToWorldTransformProps.DVDOrigin);
    const SVDExtents = Point3d.createZero();
    SVDExtents.setFromJSON(sheetToWorldTransformProps.SVDExtents);
    const SVDYaw = sheetToWorldTransformProps.SVDYaw;
    const SVDPitch = sheetToWorldTransformProps.SVDPitch;
    const SVDRoll = sheetToWorldTransformProps.SVDRoll;
    const SVDOrigin = Point3d.createZero();
    SVDOrigin.setFromJSON(sheetToWorldTransformProps.SVDOrigin);

    // We start with sheet coordinates so we tranform them to be relative to the viewAttachment
    let transform = Transform.createTranslation(Point3d.create(-VAOrigin.x, -VAOrigin.y));

    // We multiply by the sheet scale and adjust to the drawing origin to end up with DrawingViewDefinition coordinates
    transform.setMultiplyTransformTransform(Transform.createScaleAboutPoint(Point3d.createZero(), scale), transform);
    transform.setMultiplyTransformTransform(Transform.createTranslation(Point3d.create(-DVDOrigin.x, -DVDOrigin.y)), transform);

    // We recreate the spatialViewDefinition positioning matrix and transform the point to get the final 3d position
    const rotation = YawPitchRollAngles.createRadians(SVDYaw * Math.PI / 180, SVDPitch * Math.PI / 180, SVDRoll * Math.PI / 180).toMatrix3d();
    const origin = new Point3d(SVDOrigin.x, SVDOrigin.y, SVDOrigin.z);
    const boxToWorldMatrix = Transform.createRefs(origin, rotation);
    transform.setMultiplyTransformTransform(boxToWorldMatrix, transform);
    return transform;

  }

  /**
   * Gets the spatial info needed to create the transform, it will first check if it can do the generic transform but if not
   * every relation needed is present in the model, it'll try to fall back to the old civil method
   * @param imodel
   * @param drawing
   * @returns
   */
  export async function getSpatialInfo(imodel: IModelConnection, drawing: DrawingTypeData): Promise<SheetToWorldTransformProps | undefined> {
    const spatialEcsql = getSpatialViewInfoECSQL(drawing.id);

    const spatialReader = imodel.createQueryReader(spatialEcsql.ecsql, QueryBinder.from(spatialEcsql.parameters));

    const isValid = await spatialReader.step();
    if (isValid) {
      const spatialData = spatialReader.current;

      const transformProps = {
        DVDOrigin: {x: spatialData[6].X, y: spatialData[6].Y},
        sheetScale: spatialData[5],
        SVDExtents: {x: spatialData[1].X, y: spatialData[1].Y, z: spatialData[1].Z},
        SVDOrigin: {x: spatialData[0].X, y: spatialData[0].Y, z: spatialData[0].Z},
        SVDPitch: spatialData[3],
        SVDRoll: spatialData[4],
        SVDYaw: spatialData[2]
        };
      return transformProps;
    } else {
      // We don't have the section drawing relations, let's try the civil json props
      const civilEcsql = getCivilDrawingInfoECSQL(drawing.id);
      const iter = imodel.createQueryReader(civilEcsql.ecsql, QueryBinder.from(civilEcsql.parameters));

      const isValid = await iter.step();

      if (isValid) {
        const row = iter.current;
        const jsonProp = JSON.parse(row[4]);
        if (jsonProp.civilimodelconn) {
          const sheetToWorldTransform: CivilSheetTransformParams = { masterOrigin: Point3d.fromJSON(jsonProp.civilimodelconn.masterOrigin), sheetTov8Drawing: Transform.fromJSON(jsonProp.civilimodelconn.sheetToV8DrawingTransform), v8DrawingToDesign: Transform.fromJSON(jsonProp.civilimodelconn.v8DrawingToDesignTransform)};
          return {
            transformParams: sheetToWorldTransform,
            sheetScale: row[5]
          };
        }
      }
    }
    return undefined;
  }

  /**
   * Gives all the data needed for transforming points from 2d to 3d and what's needed to draw drawing contour
   * @param imodel
   * @param id
   * @param mousePos
   */
  export async function getDrawingData(imodel: IModelConnection, id: string, mousePos: Point3d): Promise<{
    sheetToWorldTransform : Transform,
    viewAttachmentOrigin: {x: number, y: number},
    viewAttachmentExtent: {x: number, y: number},
    transformProps: SheetToWorldTransformProps,
    drawingId: string
  } | undefined> {

    if (imodel.isBlank) {
      return undefined;
    }

    const drawingInfo = await DrawingDataCache.getInstance().querySheetDrawingData(imodel, id);

    const correctVAData = getCorrectDrawing(mousePos, drawingInfo);

    if (correctVAData === undefined)
      return undefined;

    const spatialInfo = await DrawingDataCache.getInstance().querySpatialInfo(imodel, correctVAData);

    if (spatialInfo === undefined)
      return undefined;

    if (spatialInfo.transformParams === undefined) {
      const transform = getTransform(correctVAData.origin, spatialInfo);
      return {sheetToWorldTransform: transform, viewAttachmentOrigin: correctVAData.origin, viewAttachmentExtent: correctVAData.bBoxHigh, drawingId: correctVAData.id, transformProps: spatialInfo};
    } else {
      const sheetToWorldTransform: CivilSheetTransformParams = { masterOrigin: Point3d.fromJSON(spatialInfo.transformParams.masterOrigin), sheetTov8Drawing: spatialInfo.transformParams.sheetTov8Drawing, v8DrawingToDesign: spatialInfo.transformParams.v8DrawingToDesign};
      return {
        drawingId: correctVAData.id,
        viewAttachmentOrigin: correctVAData.origin,
        viewAttachmentExtent: correctVAData.bBoxHigh,
        sheetToWorldTransform: getTransform(correctVAData.origin, {transformParams: sheetToWorldTransform}),
        transformProps: spatialInfo
      };
    }
  }

  function getNameFromDrawingType(type: SheetMeasurementHelper.DrawingType): string  {
    if (type === SheetMeasurementHelper.DrawingTypeEnum.Detail) {
      return IModelApp.localization.getLocalizedString("MeasureTools:SheetMeasurementTooltip.MeasurementNames.Detail");
    } else if (type === SheetMeasurementHelper.DrawingTypeEnum.Plan) {
      return IModelApp.localization.getLocalizedString("MeasureTools:SheetMeasurementTooltip.MeasurementNames.Plan");
    } else if (type === SheetMeasurementHelper.DrawingTypeEnum.ProfileOrElevation) {
      return IModelApp.localization.getLocalizedString("MeasureTools:SheetMeasurementTooltip.MeasurementNames.Elevation");
    } else if (type === SheetMeasurementHelper.DrawingTypeEnum.Section) {
      return IModelApp.localization.getLocalizedString("MeasureTools:SheetMeasurementTooltip.MeasurementNames.Section");
    } else {
      return "";
    }
  }

  export async function getSheetToolTipText(hit: HitDetail, allowedDrawingTypesList: SheetMeasurementHelper.DrawingType[], defaultToolTip:(hit: HitDetail) => Promise<HTMLElement | string>): Promise<string | HTMLElement> {
    if (SheetMeasurementHelper.checkIfAllowedDrawingType(hit.viewport, hit.hitPoint, allowedDrawingTypesList)) {
      return defaultToolTip(hit);
    }

    if (allowedDrawingTypesList.length < 1) {
      return IModelApp.localization.getLocalizedString("MeasureTools:SheetMeasurementTooltip.NoAllowedDrawingTypes");;
    }
    if (allowedDrawingTypesList.length > 1){
      let result = IModelApp.localization.getLocalizedString("MeasureTools:SheetMeasurementTooltip.MoreMeasurementsInvalidHead", { drawingName: getNameFromDrawingType(allowedDrawingTypesList[0])});
      for (let i = 1; i < allowedDrawingTypesList.length - 1; i++) {
        result = result + IModelApp.localization.getLocalizedString("MeasureTools:SheetMeasurementTooltip.MoreMeasurementsInvalidMiddle", { drawingName: getNameFromDrawingType(allowedDrawingTypesList[i])});
      }
      result = result + IModelApp.localization.getLocalizedString("MeasureTools:SheetMeasurementTooltip.MoreMeasurementsInvalidLast", { drawingName: getNameFromDrawingType(allowedDrawingTypesList[allowedDrawingTypesList.length - 1])});
      return result;
    }
    return IModelApp.localization.getLocalizedString("MeasureTools:SheetMeasurementTooltip.OneMeasurementInvalid", { drawingName: getNameFromDrawingType(allowedDrawingTypesList[0])});
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
      if (drawing.type !== undefined && allowedDrawingTypes.includes(drawing.type)) {
        if (SheetMeasurementHelper.checkIfInDrawing(point, Point2d.fromJSON(drawing.origin), Point2d.fromJSON(drawing.bBoxHigh))) {
          return true;
        }
      }
    }
    return false;
  }

  export async function getDrawingMetadata(imodel: IModelConnection, id: string, mousePos: Point3d): Promise<DrawingMetadata | undefined> {
    const drawingData = await getDrawingData(imodel, id, mousePos);
    if (drawingData?.drawingId !== undefined && drawingData.viewAttachmentOrigin !== undefined && drawingData.transformProps !== undefined)
      return { origin: Point2d.fromJSON(drawingData.viewAttachmentOrigin), drawingId: drawingData.drawingId, sheetToWorldTransformProps: drawingData.transformProps, extents: Point2d.fromJSON(drawingData.viewAttachmentExtent), sheetToWorldTransformv2: drawingData.sheetToWorldTransform};
    return undefined;
  }

}

/**
 * @deprecated Use SheetMeasurementHelper instead
 */
export namespace SheetMeasurementsHelper {

  /** This maps directly to the viewType field found in the schema on BisCore.viewAttachment
   * @deprecated Use SheetMeasurementHelper.DrawingType instead
  */
  export enum DrawingType {
    CrossSection = 3,
    Profile = 5,
    Plan = 6
  }

  /**
   * Used as parameter for measurement transform operation which is a 3 step process
   * @deprecated use SheetMeasurementHelper.SheetTransformParams instead
   */
  export interface SheetTransformParams {
    masterOrigin: Point3d;
    sheetTov8Drawing: Transform;
    v8DrawingToDesign: Transform;
  }

  /**
   * @deprecated use SheetMeasurementHelper.DrawingTypeData instead
   */
  export interface DrawingTypeData {
    origin: Point2d;
    extents: Point2d;
    type: DrawingType;
  }

  /**
   * @deprecated Use SheetMeasurementHelper's functions instead
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

  /**
   * @deprecated use SheetMeasurementHelper.checkIfInDrawing instead
   * @param point
   * @param drawingOrigin
   * @param drawingExtents
   * @returns
   */
  export function checkIfInDrawing(point: Point3d, drawingOrigin: Point2d, drawingExtents: Point2d): boolean {
    return (point.x >= drawingOrigin.x && point.x <= drawingExtents.x + drawingOrigin.x && point.y >= drawingOrigin.y && point.y <= drawingExtents.y + drawingOrigin.y);
  }

  /**
   * @deprecated use SheetMeasurementHelper.getDrawingContourGraphic instead
   * @param context
   * @param origin
   * @param extents
   * @returns
   */
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
   * @deprecated use SheetMeasurementHelper's functions instead
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

  /**
   * @deprecated use SheetMeasurementHelper's functions instead
   */
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
      const jsonProp = row[4] && JSON.parse(row[4]);
      if (jsonProp && jsonProp.civilimodelconn) {
        const origin = new Point2d(row[1].X, row[1].Y);
        const extents = new Point2d(highX, highY);
        const viewType = jsonProp.civilimodelconn.viewType;
        result.push({origin, extents, type: viewType});
      }
    }

    return result;
  }

  /**
   * @deprecated use SheetMeasurementHelper.checkIfAllowedDrawingType instead
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
      if (drawing.type && allowedDrawingTypes.includes(drawing.type)) {
        if (SheetMeasurementsHelper.checkIfInDrawing(point, Point2d.fromJSON(drawing.origin), Point2d.fromJSON(drawing.bBoxHigh))) {
          return true;
        }
      }
    }
    return false;
  }

  function getNameFromDrawingType(type: SheetMeasurementsHelper.DrawingType): string  {
    if (type === SheetMeasurementsHelper.DrawingType.CrossSection) {
      return IModelApp.localization.getLocalizedString("MeasureTools:SheetMeasurementTooltip.MeasurementNames.CrossSection");
    } else if (type === SheetMeasurementsHelper.DrawingType.Plan) {
      return IModelApp.localization.getLocalizedString("MeasureTools:SheetMeasurementTooltip.MeasurementNames.Plan");
    } else if (type === SheetMeasurementsHelper.DrawingType.Profile) {
      return IModelApp.localization.getLocalizedString("MeasureTools:SheetMeasurementTooltip.MeasurementNames.Profile");
    } else {
      return "";
    }
  }

  /**
   * @deprecated use SheetMeasurementHelper.getSheetToolTipText instead
   * @param hit
   * @param allowedDrawingTypesList
   * @param defaultToolTip
   * @returns
   */
  export async function getSheetToolTipText(hit: HitDetail, allowedDrawingTypesList: SheetMeasurementsHelper.DrawingType[], defaultToolTip:(hit: HitDetail) => Promise<HTMLElement | string>): Promise<string | HTMLElement> {
    if (SheetMeasurementsHelper.checkIfAllowedDrawingType(hit.viewport, hit.hitPoint, allowedDrawingTypesList)) {
      return defaultToolTip(hit);
    }

    if (allowedDrawingTypesList.length < 1) {
      return IModelApp.localization.getLocalizedString("MeasureTools:SheetMeasurementTooltip.NoAllowedDrawingTypes");;
    }
    if (allowedDrawingTypesList.length > 1){
      let result = IModelApp.localization.getLocalizedString("MeasureTools:SheetMeasurementTooltip.MoreMeasurementsInvalidHead", { drawingName: getNameFromDrawingType(allowedDrawingTypesList[0])});
      for (let i = 1; i < allowedDrawingTypesList.length - 1; i++) {
        result = result + IModelApp.localization.getLocalizedString("MeasureTools:SheetMeasurementTooltip.MoreMeasurementsInvalidMiddle", { drawingName: getNameFromDrawingType(allowedDrawingTypesList[i])});
      }
      result = result + IModelApp.localization.getLocalizedString("MeasureTools:SheetMeasurementTooltip.MoreMeasurementsInvalidLast", { drawingName: getNameFromDrawingType(allowedDrawingTypesList[allowedDrawingTypesList.length - 1])});
      return result;
    }
    return IModelApp.localization.getLocalizedString("MeasureTools:SheetMeasurementTooltip.OneMeasurementInvalid", { drawingName: getNameFromDrawingType(allowedDrawingTypesList[0])});
  }
}
