/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import type { IModelConnection } from "@itwin/core-frontend";
import { Range3d } from "@itwin/core-geometry";

export class DataLink {
  public static async queryAllBuildings(iModel: IModelConnection) {
    const query = `SELECT building.ECInstanceId as id, building.UserLabel as label, building.CodeValue as code
    FROM BuildingSpatial:Building building`;

    return this.executeQuery(iModel, query);
  }

  // This doesn't work on Revit derived data because:
  //  a. Too many stories (need to limit to those with rooms) and
  //  b. No composingElement (because no buildings)
  public static async queryAllStories(iModel: IModelConnection) {
    const query = `SELECT story.ECInstanceId as id, story.UserLabel as label, story.CodeValue as code, building.ECInstanceId as composingId FROM BuildingSpatial:Story story JOIN BuildingSpatial.Building building ON building.ECInstanceId = story.composingElement.id`;

    return this.executeQuery(iModel, query);
  }

  // Use this for Revit derived data to work around issues with queryAllStories
  public static async queryStoriesWithRooms(iModel: IModelConnection) {
    const query = `SELECT DISTINCT story.ECInstanceId as id, story.UserLabel as label, story.CodeValue as code
    FROM BuildingSpatial:Story story, BuildingSpatial:Space room WHERE room.composingElement.id = story.ECInstanceId`;

    return this.executeQuery(iModel, query);
  }

  public static async queryStoryRange(iModel: IModelConnection, storyId: string, clipAtSpaces: boolean): Promise<Range3d | undefined> {
    const runQuery = async (query: string) => {
      const rows = await this.executeQuery(iModel, query);

      if (rows.length > 0 && rows[0].minX)
        return new Range3d(rows[0].minX, rows[0].minY, rows[0].minZ, rows[0].maxX, rows[0].maxY, rows[0].maxZ);
      return undefined;
    };

    const constructQuery = (queryClass: string) => {
      return `select MIN(spel.minX) as minX, MIN(spel.minY) as minY, MIN(spel.minZ) as minZ, MAX(spel.maxX) as maxX, MAX(spel.maxY) as maxY, MAX(spel.maxZ) as maxZ
        from ${queryClass} ovr join biscore.spatialIndex spel on spel.ECinstanceId = ovr.targetecinstanceid
        where sourceECInstanceId in
        (select sp.ecinstanceid from buildingspatial.story s join buildingspatial.space sp on s.ecinstanceid=sp.composingelement.id where s.ecinstanceid=${storyId}
        union
        select s.ecinstanceid from buildingspatial.story s where s.ecinstanceid=${storyId})`;
    };

    let result;

    if (clipAtSpaces) {
      result = await runQuery(constructQuery("spatialcomposition.CompositeComposesSubComposites"));
    }

    return result ?? runQuery(constructQuery("spatialcomposition.CompositeOverlapsSpatialElements"));
  }

  public static async queryRooms(iModel: IModelConnection, storyId?: string) {
    const baseQuery = `SELECT room.ECInstanceId as id, room.UserLabel as label, room.CodeValue as code, room.BBoxHigh as bBoxHigh, room.BBoxLow as bBoxLow, story.ECInstanceId as composingId
    FROM BuildingSpatial:Space room
    JOIN Spatial.Story story ON story.ECInstanceId = room.composingElement.id`;
    const whereClause = storyId ? ` WHERE story.ECInstanceId = ${storyId}` : "";

    return this.executeQuery(iModel, baseQuery + whereClause);
  }

  public static async queryCategoryIds(iModel: IModelConnection, categoryNames: string[]) {
    const namesString = categoryNames.map((name: string) => `'${name}'`).join(", ");
    const query = `select * from BisCore.SpatialCategory where CodeValue IN ( ${namesString})`;
    const rows = await this.executeQuery(iModel, query);
    return rows.map((row) => row.id);
  }

  public static async querySpatialIndex(iModel: IModelConnection, elementId: string) {
    const query = `SELECT ECInstanceId FROM biscore.spatialIndex where ECInstanceId = ${elementId}`;

    return this.executeQuery(iModel, query);
  }

  public static async queryChildWithGeometry(iModel: IModelConnection, elementId: string) {
    const query = `select ECInstanceId from biscore.spatialelement where Parent.id = ${elementId}`;

    return this.executeQuery(iModel, query);
  }

  private static async executeQuery(iModel: IModelConnection, query: string) {
    const res = iModel.createQueryReader(query, undefined, { rowFormat: 0 });
    const rows = await res.toArray();
    return rows;
  }
}
