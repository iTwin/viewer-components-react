/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import type { IModel, QueryOptions} from "@itwin/core-common";
import { QueryBinder } from "@itwin/core-common";
import { Point2d, Point3d } from "@itwin/core-geometry";

interface idAndLocation {
  id?: string;
  origin?: Point2d;
  extents?: Point2d;
}

export class SheetMeasurementsHelper {

  /** The frontend / backend subclasses of IModel both have the same query function signature but it isn't present in the base class. Initiates a concurrent ECSql query. */
  public static doIModelQuery(imodel: IModel, ecsql: string, params?: object | QueryBinder, options?: QueryOptions): AsyncIterableIterator<any> {
    const queryBinder = undefined === params || params instanceof QueryBinder ? params : QueryBinder.from(params);
    const imodelAny = imodel as any;
    return imodelAny.query(ecsql, queryBinder, options) as AsyncIterableIterator<any>;
  }

  /**
   * @param imodel
   * @param id SheetViewDefinition ID
   * @param mousePos position of the mouse click
   * @returns Id of the clicked on drawing
   */
  public static async getDrawingId(imodel: IModel, id: string, mousePos: Point3d): Promise<idAndLocation | undefined> {
    const { ecsql, parameters } = SheetMeasurementsHelper.getDrawingInfoECSQL(id);

    const iter = SheetMeasurementsHelper.doIModelQuery(imodel, ecsql, QueryBinder.from(parameters));

    for await (const row of iter) {
      const x = mousePos.x;
      const y = mousePos.y;
      if (x >= row[1].X && x <= row[1].X + row[2].X) {
        // Within x extents
        if (y >= row[1].Y && y <= row[1].Y + row[2].Y) {
          // Within y extents
          const result: idAndLocation = {
            id: row[0],
            origin: new Point2d(row[1].X, row[1].Y),
            extents: new Point2d(row[2].X, row[2].Y),
          };
          return result;
        }
      }
    }
    // Not in any drawing
    return undefined;
  }

  private static getDrawingInfoECSQL(id: string) {
    const ecsql = "SELECT [d].ECInstanceId, \
      [dvd].origin, \
      [dvd].Extents \
      FROM Biscore.sheetViewDefinition [svd], Biscore.sheet [s], Biscore.viewAttachment [va], Biscore.DrawingViewDefinition [dvd], Biscore.drawing [d] \
      WHERE [svd].ECInstanceId =:[id] \
      AND [svd].basemodel.id = [s].EcInstanceId \
      AND [s].ECInstanceId = [va].model.id \
      AND [va].view.id = [dvd].ECInstanceId \
      AND [dvd].baseModel.id = [d].ECInstanceId";

    return { ecsql, parameters: { id }};
  }

  private static async getScale(imodel: IModel, id: string): Promise<number | undefined>{

    const { ecsql, parameters } = SheetMeasurementsHelper.getScaleECSQL(id);

    const iter = SheetMeasurementsHelper.doIModelQuery(imodel, ecsql, QueryBinder.from(parameters));

    for await (const row of iter) {
      if (row[0] !== undefined) {
        const info = JSON.parse(row[0]);
        if (info.scale !== undefined)
          return info.scale;
      }
    }

    return undefined;
  }

  public static async getRatio(imodel: IModel, id: string): Promise<number | undefined> {

    // Check if the scale is present in the viewAttachment JsonProperties
    const scale = await SheetMeasurementsHelper.getScale(imodel, id);
    if (scale)
      return scale;

    // Otherwise, we make a ratio but this method might add a small rounding error if the drawing does not exactly match the spatialViewDefinition area
    const { ecsql, parameters } = SheetMeasurementsHelper.getRatioECSQL(id);

    const iter = SheetMeasurementsHelper.doIModelQuery(imodel, ecsql, QueryBinder.from(parameters));

    for await (const row of iter) {
      if (row[0] !== undefined && row[1] !== undefined && row[2] !== undefined && row[3] !== undefined) {
        const distance2d = new Point2d(row[2].X, row[2].Y).distance(new Point2d(row[2].X + row[3].X, row[2].Y + row[3].Y));
        const distance3d = new Point3d(row[0].X, row[0].Y, row[0].Z).distance(new Point3d(row[0].X + row[1].X, row[0].Y + row[1].Y, row[0].Z + row[1].Z));
        return distance3d / distance2d;
      }
    }

    return undefined;
  }

  private static getScaleECSQL(id: string) {
    const ecsql = "SELECT [va].JsonProperties \
    FROM Biscore.viewAttachment [va], Biscore.DrawingViewDefinition [dvd] \
    WHERE [dvd].baseModel.id =:[id] \
    AND [dvd].ECInstanceId = [va].view.id";

    return { ecsql, parameters: { id }};
  }

  private static getRatioECSQL(id: string) {
    const ecsql = "SELECT [spvd].origin as SPVD_ORIGIN, \
    [spvd].extents as SPVD_EXTENTS, \
    [dvd].origin as DVD_ORIGIN, \
    [dvd].extents as DVD_EXTENTS \
    FROM Biscore.spatialViewDefinition [spvd], Generic.viewAttachmentLabel [val], Biscore.viewAttachment [va], Biscore.DrawingViewDefinition [dvd] \
    WHERE [dvd].baseModel.id =:[id] \
    AND [dvd].ECInstanceId = [va].view.id \
    AND [va].ECInstanceId = [val].viewAttachment.id \
    AND [val].userLabel = [spvd].codeValue";

    return { ecsql, parameters: { id }};
  }

  public static checkIfInDrawing(point: Point3d, drawingOrigin: Point2d, drawingExtents: Point2d): boolean {
    return (point.x >= drawingOrigin.x && point.x <= drawingExtents.x + drawingOrigin.x && point.y >= drawingOrigin.y && point.y <= drawingExtents.y + drawingOrigin.y);
  }
}
