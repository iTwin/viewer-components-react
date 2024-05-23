/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { ColorDef, QueryBinder } from "@itwin/core-common";
import type { DecorateContext, GraphicBuilder, IModelConnection } from "@itwin/core-frontend";
import { GraphicType } from "@itwin/core-frontend";
import type { Point3d } from "@itwin/core-geometry";
import { Point2d } from "@itwin/core-geometry";
import type { DrawingMetaData } from "./Measurement";

export namespace SheetMeasurementsHelper {

  /**
   * @param imodel
   * @param id SheetViewDefinition ID
   * @param mousePos position of the mouse click
   * @returns Id of the clicked on drawing
   */
  export async function getDrawingId(imodel: IModelConnection, id: string, mousePos: Point3d): Promise<DrawingMetaData | undefined> {
    const { ecsql, parameters } = getDrawingInfoECSQL(id);

    const iter = imodel.createQueryReader(ecsql, QueryBinder.from(parameters));

    for await (const row of iter) {
      const x = mousePos.x;
      const y = mousePos.y;
      if (x >= row[1].X && x <= row[1].X + row[2].X) {
        // Within x extents
        if (y >= row[1].Y && y <= row[1].Y + row[2].Y) {
          // Within y extents
          const jsonProp = JSON.parse(row[3]);
          const scale = jsonProp.scale;
          const result: DrawingMetaData = {
            drawingId: row[0],
            origin: new Point2d(row[1].X, row[1].Y),
            extents: new Point2d(row[2].X, row[2].Y),
            worldScale: scale,
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
      [dvd].Extents, \
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
}
