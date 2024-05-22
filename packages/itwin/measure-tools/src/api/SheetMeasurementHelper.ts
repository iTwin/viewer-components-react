/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { ColorDef, QueryBinder } from "@itwin/core-common";
import type { DecorateContext, GraphicBuilder, IModelConnection } from "@itwin/core-frontend";
import { GraphicType } from "@itwin/core-frontend";
import { Point2d, Point3d } from "@itwin/core-geometry";

interface IdAndLocation {
  id?: string;
  origin?: Point2d;
  extents?: Point2d;
}

export namespace SheetMeasurementsHelper {

  /**
   * @param imodel
   * @param id SheetViewDefinition ID
   * @param mousePos position of the mouse click
   * @returns Id of the clicked on drawing
   */
  export async function getDrawingId(imodel: IModelConnection, id: string, mousePos: Point3d): Promise<IdAndLocation | undefined> {
    const { ecsql, parameters } = getDrawingInfoECSQL(id);

    const iter = imodel.createQueryReader(ecsql, QueryBinder.from(parameters));

    for await (const row of iter) {
      const x = mousePos.x;
      const y = mousePos.y;
      if (x >= row[1].X && x <= row[1].X + row[2].X) {
        // Within x extents
        if (y >= row[1].Y && y <= row[1].Y + row[2].Y) {
          // Within y extents
          const result: IdAndLocation = {
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

  function getDrawingInfoECSQL(id: string) {
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

  export async function getScale(imodel: IModelConnection, id: string): Promise<number | undefined>{

    const { ecsql, parameters } = getScaleECSQL(id);

    const iter = imodel.createQueryReader(ecsql, QueryBinder.from(parameters));

    for await (const row of iter) {
      if (row[0] !== undefined) {
        const info = JSON.parse(row[0]);
        if (info.scale !== undefined)
          return info.scale;
      }
    }

    return undefined;
  }

  export async function getRatio(imodel: IModelConnection, id: string): Promise<number | undefined> {

    // Check if the scale is present in the viewAttachment JsonProperties
    const scale = await getScale(imodel, id);
    if (scale)
      return scale;

    // Otherwise, we make a ratio but this method might add a small rounding error if the drawing does not exactly match the spatialViewDefinition area
    const { ecsql, parameters } = getRatioECSQL(id);

    const iter = imodel.createQueryReader(ecsql, QueryBinder.from(parameters));

    for await (const row of iter) {
      if (row[0] !== undefined && row[1] !== undefined && row[2] !== undefined && row[3] !== undefined) {
        const distance2d = new Point2d(row[2].X, row[2].Y).distance(new Point2d(row[2].X + row[3].X, row[2].Y + row[3].Y));
        const distance3d = new Point3d(row[0].X, row[0].Y, row[0].Z).distance(new Point3d(row[0].X + row[1].X, row[0].Y + row[1].Y, row[0].Z + row[1].Z));
        return distance3d / distance2d;
      }
    }

    return undefined;
  }

  function getScaleECSQL(id: string) {
    const ecsql = "SELECT [va].JsonProperties \
    FROM Biscore.viewAttachment [va], Biscore.DrawingViewDefinition [dvd] \
    WHERE [dvd].baseModel.id =:[id] \
    AND [dvd].ECInstanceId = [va].view.id";

    return { ecsql, parameters: { id }};
  }

  function getRatioECSQL(id: string) {
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
}
