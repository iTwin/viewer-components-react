/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { Id64String } from "@itwin/core-bentley";
import { QueryBinder } from "@itwin/core-common";
import { BeButtonEvent, IModelConnection } from "@itwin/core-frontend";
import { Point2d, Point3d, Range2d, Transform } from "@itwin/core-geometry";

interface BindingParameters {
  [key: string]: string;
}

export class TransformHelper {

  /**
   * Applies the transform on all points if it exists
   * @param transform
   * @param points
   * @returns
   */
  public static applyTransform(transform: Transform | undefined, ...points: Point3d[]) {
    if (!transform)
      return points;

    const result = points.map((point) => {
      return transform.multiplyPoint3d(point);
    })
    return result;
  }

  public static async getSheetToWorldTransform(ev: BeButtonEvent, connection: IModelConnection): Promise<Transform | undefined> {
    if (!ev.viewport)
      return undefined;

    const drawingIds = await TransformHelper.queryAttachedDrawings(connection, ev.viewport.view.id);
    const boundingBoxes = await TransformHelper.queryBoundingBoxes(connection, drawingIds);
    const correctDrawingId = TransformHelper.getCorrectDrawingForPosition(boundingBoxes, ev.point);
    const matrix = await TransformHelper.querySheetToSpatialTransform(connection, correctDrawingId ? correctDrawingId : drawingIds[0].id);
    return matrix;
  }

  private static attachedDrawingsESQL(viewId: string): { ecsql: string, parameters: BindingParameters } {
    const ecsql = `select drawDef.baseModel.Id FROM BisCore.DrawingViewDefinition drawDef, BisCore.ViewAttachment att,
    BisCore.sheetViewDefinition sheetDef WHERE sheetDef.baseModel.id =
    att.model.id AND att.view.id = drawDef.ECInstanceId AND sheetDef.ECInstanceId = :viewId`;
    return { ecsql, parameters: { viewId } };
  }

  private static async queryAttachedDrawings(imodel: IModelConnection, viewid: string) {
    const { ecsql, parameters } = this.attachedDrawingsESQL(viewid);
    const queryReader = imodel.createQueryReader(ecsql, QueryBinder.from(parameters));
    const result = [];

    while (await queryReader.step()) {
      result.push(queryReader.current.toRow());
    }
    return result;
  }

  private static boundingBoxESQL(drawingId: string): { ecsql: string, parameters: BindingParameters } {
    const ecsql = `select drawDef.baseModel.Id, att.origin, att.bBoxLow, att.bBoxHigh, att.rotation from BisCore.ViewAttachment att,
    BisCore.DrawingViewDefinition drawDef where drawDef.ECInstanceId = att.view.id AND drawDef.baseModel.Id = :drawingId`;
    return { ecsql, parameters: { drawingId } };
  }

  private static async queryBoundingBoxes(imodel: IModelConnection, drawingIds: { Id: string }[]) {
    const results = [];
    // eslint-disable-next-line @typescript-eslint/prefer-for-of
    for (let index = 0; index < drawingIds.length; index++) {
      const { ecsql, parameters } = this.boundingBoxESQL(drawingIds[index].Id);
      const queryReader = imodel.createQueryReader(ecsql, QueryBinder.from(parameters));
      while (await queryReader.step()) {
        results.push(queryReader.current.toRow());
      }
    }
    return results;
  }

  private static getCorrectDrawingForPosition(drawingList: { Id: string, BBoxHigh: { X: number, Y: number }, BBoxLow: { X: number, Y: number }, Origin: { X: number, Y: number }, rotation: number }[], mousePoint: Point3d): string | undefined {
    // eslint-disable-next-line @typescript-eslint/prefer-for-of
    for (let index = 0; index < drawingList.length; index++) {
      const currentDrawing = drawingList[index];
      const range2d = new Range2d(currentDrawing.BBoxLow.X, currentDrawing.BBoxLow.Y, currentDrawing.BBoxHigh.X, currentDrawing.BBoxHigh.Y);
      const origin = new Point2d(currentDrawing.Origin.X, currentDrawing.Origin.Y);
      let point2d = Point2d.createFrom(mousePoint);
      point2d = point2d.minus(origin);
      if (range2d.containsPoint(point2d)) {
        return currentDrawing.Id;
      }
    }
    return undefined;
  }

  private static async queryDrawingProperties(imodel: IModelConnection, drawingId: Id64String) {
    const queryReader = imodel.createQueryReader("SELECT jsonProperties from BisCore.Drawing WHERE ECInstanceId = " + drawingId);

    const result = [];

    while (await queryReader.step()) {
      result.push(queryReader.current.toRow());
    }

    return result[0].JsonProperties;
  }

  private static async querySheetToSpatialTransform(imodel: IModelConnection, drawingId: Id64String): Promise<Transform | undefined> {
    const properties = (await TransformHelper.queryDrawingProperties(imodel, drawingId));
    const matrix = Transform.createZero();
    if (properties) {
      matrix.setFromJSON(JSON.parse(properties).sheetToSpatialTransform);
      return matrix;
    } else {
      return undefined;
    }
  }

}
