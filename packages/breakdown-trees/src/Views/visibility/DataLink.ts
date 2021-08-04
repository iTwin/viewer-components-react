/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { IModelConnection } from "@bentley/imodeljs-frontend";
import { Range3d } from "@bentley/geometry-core";

export class DataLink {
  public static async queryAllBuildings(iModel: IModelConnection) {
    const query = `SELECT building.ECInstanceId as id, building.UserLabel as label, building.CodeValue as code
    FROM BuildingSpatial:Building building`;
    const rows = await this.executeQuery(iModel, query);

    return rows;
  }

  // This doesn't work on Revit derived data because:
  //  a. Too many stories (need to limit to those with rooms) and
  //  b. No composingElement (because no buildings)
  public static async queryAllStories(iModel: IModelConnection) {
    const query = `SELECT story.ECInstanceId as id, story.UserLabel as label, story.CodeValue as code, building.ECInstanceId as composingId FROM BuildingSpatial:Story story JOIN BuildingSpatial.Building building ON building.ECInstanceId = story.composingElement.id`;
    const rows = await this.executeQuery(iModel, query);

    return rows;
  }

  // Use this for Revit derived data to work around issues with queryAllStories
  public static async queryStoriesWithRooms(iModel: IModelConnection) {
    const query = `SELECT DISTINCT story.ECInstanceId as id, story.UserLabel as label, story.CodeValue as code
    FROM BuildingSpatial:Story story, BuildingSpatial:Space room WHERE room.composingElement.id = story.ECInstanceId`;
    const rows = await this.executeQuery(iModel, query);
    return rows;
  }

  public static async queryStoryRange(iModel: IModelConnection, storyId: string, clipAtSpaces: boolean): Promise<Range3d | undefined> {
    const queryGetStoryWithElementsProps = `select MIN(spel.minX) as minX, MIN(spel.minY) as minY, MIN(spel.minZ) as minZ, MAX(spel.maxX) as maxX, MAX(spel.maxY) as maxY, MAX(spel.maxZ) as maxZ
    from spatialcomposition.CompositeOverlapsSpatialElements ovr join biscore.spatialIndex spel on spel.ECinstanceId = ovr.targetecinstanceid
    where sourceECInstanceId in
    (select sp.ecinstanceid from buildingspatial.story s join buildingspatial.space sp on s.ecinstanceid=sp.composingelement.id where s.ecinstanceid=${storyId}
    union
    select s.ecinstanceid from buildingspatial.story s where s.ecinstanceid=${storyId})`;

    let queryGetStoreyProps;
    if (clipAtSpaces) {
      queryGetStoreyProps = `select MIN(spel.minX) as minX, MIN(spel.minY) as minY, MIN(spel.minZ) as minZ, MAX(spel.maxX) as maxX, MAX(spel.maxY) as maxY, MAX(spel.maxZ) as maxZ
      from spatialcomposition.CompositeComposesSubComposites ovr join biscore.spatialIndex spel on spel.ECinstanceId = ovr.targetecinstanceid
      where sourceECInstanceId in
      (select sp.ecinstanceid from buildingspatial.story s join buildingspatial.space sp on s.ecinstanceid=sp.composingelement.id where s.ecinstanceid=${storyId}
      union
      select s.ecinstanceid from buildingspatial.story s where s.ecinstanceid=${storyId})`;
      let rows = await this.executeQuery(iModel, queryGetStoreyProps);
      if (rows.length > 0 && rows[0].minX)
        return new Range3d(rows[0].minX, rows[0].minY, rows[0].minZ, rows[0].maxX, rows[0].maxY, rows[0].maxZ);
      rows = await this.executeQuery(iModel, queryGetStoryWithElementsProps);
      if (rows.length > 0 && rows[0].minX)
        return new Range3d(rows[0].minX, rows[0].minY, rows[0].minZ, rows[0].maxX, rows[0].maxY, rows[0].maxZ);
    } else {
      queryGetStoreyProps = queryGetStoryWithElementsProps;
      const rows = await this.executeQuery(iModel, queryGetStoreyProps);
      if (rows.length > 0 && rows[0].minX)
        return new Range3d(rows[0].minX, rows[0].minY, rows[0].minZ, rows[0].maxX, rows[0].maxY, rows[0].maxZ);
    }
    return undefined;
  }

  public static async queryRooms(iModel: IModelConnection, storyId?: string) {
    let query = "";
    query = `SELECT room.ECInstanceId as id, room.UserLabel as label, room.CodeValue as code, room.BBoxHigh as bBoxHigh, room.BBoxLow as bBoxLow, story.ECInstanceId as composingId
    FROM BuildingSpatial:Space room
    JOIN Spatial.Story story ON story.ECInstanceId = room.composingElement.id`;

    if (storyId)
      query += ` WHERE story.ECInstanceId = ${storyId}`;

    /*
  if (parentId) {
    query = `SELECT room.ECInstanceId as id, room.UserLabel as label, room.CodeValue as code, story.ECInstanceId as composingId
    FROM BuildingSpatial:Space room
    JOIN Spatial.Story story ON story.ECInstanceId = room.composingElement.id WHERE story.ECInstanceId = ${parentId}`;
  } else {
    query = `SELECT room.ECInstanceId as id, room.UserLabel as label, room.CodeValue as code, story.ECInstanceId as composingId
    FROM BuildingSpatial:Space room
    JOIN Spatial.Story story ON story.ECInstanceId = room.composingElement.id`;
  }
  */

    const rows = await this.executeQuery(iModel, query);
    return rows;
  }

  public static async queryAllSensors(iModel: IModelConnection) {

    const queries = [];
    let rows: any[] = [];

    // // IFC sensor queries
    // queries.push(`SELECT sensor.ECInstanceId as id, sensor.UserLabel as label, sensor.CodeValue as code, sensor.Origin as origin, link.SourceECInstanceId as composingId, aspect.ifcDeviceId as presenceSensorId
    // FROM Bis.SpatialElement sensor
    // JOIN Bis.ElementRefersToElements link ON sensor.ECInstanceId = link.TargetECInstanceId
    // JOIN IfcDynamic.ifcAspect_IfcDistributionControlElement_Text aspect ON aspect.Element.Id = sensor.ECInstanceId
    // WHERE UserLabel LIKE '%sensor%' OR UserLabel LIKE '%motion%' OR CodeValue LIKE '%device%'`);

    // Revit queries
    queries.push(`SELECT sensor.ECInstanceId as id, sensor.UserLabel as label, sensor.CodeValue as code, sensor.Origin as origin, link.SourceECInstanceId as composingId, sensor.BACnet_TemperatureSensor as temperatureSensorId, sensor.BACnet_HumiditySensor as humiditySensorId, sensor.AKS_Nummer as aks_number
    FROM RevitDynamic._300S_Fuhler_Raumbediengerat_QMX sensor
    JOIN Bis.ElementRefersToElements link ON sensor.ECInstanceId = link.TargetECInstanceId`);

    queries.push(`SELECT sensor.ECInstanceId as id, sensor.UserLabel as label, sensor.CodeValue as code, sensor.Origin as origin, link.SourceECInstanceId as composingId, sensor.BACnet_TemperatureSensor as temperatureSensorId, sensor.AKS_Nummer as aks_number
    FROM RevitDynamic._300S_Kabeltemperaturfuhler_QAP sensor
    JOIN Bis.ElementRefersToElements link ON sensor.ECInstanceId = link.TargetECInstanceId`);

    queries.push(`SELECT sensor.ECInstanceId as id, sensor.UserLabel as label, sensor.CodeValue as code, sensor.Origin as origin, link.SourceECInstanceId as composingId, sensor.BACnet_CO2Sensor as airQualitySensorId, sensor.AKS_Nummer as aks_number
    FROM RevitDynamic._300S_Kanal_Luftqualitatsfuhler_QPM sensor
    JOIN Bis.ElementRefersToElements link ON sensor.ECInstanceId = link.TargetECInstanceId`);

    for (const query of queries) {
      try {
        rows = rows.concat(await this.executeQuery(iModel, query));
      } catch (e) {
        // tslint:disable-next-line:no-console
        console.log(e);
      }
    }

    return rows;
  }

  public static async queryPhysicalView(iModel: IModelConnection) {
    const query = `SELECT ECInstanceId as id, CodeValue as code FROM Bis.ViewDefinition3d`;
    const viewDefinitions = await this.executeQuery(iModel, query);

    return viewDefinitions;
  }

  public static async queryAllDrawingViews(iModel: IModelConnection) {
    const query = `SELECT ECInstanceId as id, CodeValue as code FROM Bis.DrawingViewDefinition`;
    const viewDefinitions = await this.executeQuery(iModel, query);

    return viewDefinitions;
  }

  public static async queryAllDrawingGraphics(iModel: IModelConnection) {
    const query = `SELECT EcInstanceId as id, UserLabel as label FROM Bis.DrawingGraphic`;
    const drawingGraphics = await this.executeQuery(iModel, query);

    return drawingGraphics;
  }

  public static async queryPhysicalOverlapsRooms(iModel: IModelConnection, roomIds: string[]) {
    const roomIdsString = roomIds.join(", ");
    const query = `SELECT Distinct(element.ECInstanceId)
    FROM Bis.PhysicalElement element
    JOIN SpatialComposition.CompositeOverlapsSpatialElements roomToElement ON element.ECInstanceId = roomToElement.TargetECInstanceId
    JOIN Spatial.Space room ON room.ECInstanceId = roomToElement.SourceECInstanceId WHERE room.ECInstanceId IN (` + roomIdsString + ")";
    const rows = await this.executeQuery(iModel, query);
    const physicalIDs = rows.map((row) => row.id);
    return physicalIDs;
  }

  public static async queryCategoryIds(iModel: IModelConnection, categoryNames: string[]) {
    const namesString = categoryNames.map((name: string) => `'` + name + `'`).join(", ");
    const query = "select * from BisCore.SpatialCategory where CodeValue IN ( " + namesString + ")";
    const rows = await this.executeQuery(iModel, query);
    const ids = rows.map((row) => row.id);
    return ids;
  }

  public static async querySpatialIndex(iModel: IModelConnection, elementId: string) {
    let query = "";
    query = `SELECT ECInstanceId FROM biscore.spatialIndex where ECInstanceId = ${elementId}`;

    const rows = await this.executeQuery(iModel, query);
    return rows;
  }

  public static async queryChildWithGeometry(iModel: IModelConnection, elementId: string) {
    let query = "";
    query = `select ECInstanceId from biscore.spatialelement where Parent.id = ${elementId}`;

    const rows = await this.executeQuery(iModel, query);
    return rows;
  }

  private static async executeQuery(iModel: IModelConnection, query: string) {
    const rows = [];
    for await (const row of iModel.query(query)) rows.push(row);
    return rows;
  }

}
