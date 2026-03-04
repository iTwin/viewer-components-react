/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
import type { CurvePrimitive, GeometryQuery } from "@itwin/core-geometry";
import {
  Angle,
  Arc3d,
  Box,
  CurveChainWithDistanceIndex,
  IndexedPolyface,
  IndexedPolyfaceVisitor,
  LineSegment3d,
  LineString3d,
  Loop,
  Path,
  Point3d,
  PolyfaceBuilder,
  Range3d,
  StrokeOptions,
  Transform,
  YawPitchRollAngles,
} from "@itwin/core-geometry";
import { ColorByName, ColorDef, LinePixels, Placement3d, QueryBinder, QueryRowFormat } from "@itwin/core-common";
import type { DecorateContext, Decorator, GraphicBuilder, RenderGraphic } from "@itwin/core-frontend";
import { GraphicBranch, GraphicType, IModelApp, Marker } from "@itwin/core-frontend";

export enum BboxDimension {
  BoundingBoxShortestEdgeLength = "Shortest Edge Length",
  BoundingBoxIntermediateEdgeLength = "Intermediate Edge Length",
  BoundingBoxLongestEdgeLength = "Longest Edge Length",
  BoundingBoxShortestFaceDiagonalLength = "Shortest Face Diagonal Length",
  BoundingBoxIntermediateFaceDiagonalLength = "Intermediate Face Diagonal Length",
  BoundingBoxLongestFaceDiagonalLength = "Longest Face Diagonal Length",
  BoundingBoxDiagonalLength = "Diagonal Length",
  // SmallestFaceArea = "Smallest Face Area",
  // IntermediateFaceArea = "Intermediate Face Area",
  // LargestFaceArea = "Largest Face Area",
  // Volume = "Volume"
}

interface CustomGeometryQuery {
  geometry: GeometryQuery;
  color: ColorDef;
  fill: boolean;
  fillColor: ColorDef;
  lineThickness: number;
  edges: boolean;
  linePixels: LinePixels;
}

interface CustomPoint {
  point: Point3d;
  color: ColorDef;
  fill: boolean;
  lineThickness: number;
}

interface SpatialElementQueryResult {
  bBoxHigh: Point3d;
  bBoxLow: Point3d;
  yaw: number;
  pitch: number;
  roll: number;
  origin: Point3d;
}

interface InferredSpatialData {
  pointMappings: Map<BboxDimension, [number, number]>;
  placement: Placement3d;
}

export class BboxDimensionsDecorator implements Decorator {
  private instance: InferredSpatialData | undefined;
  private graphics: RenderGraphic | undefined;
  private points: CustomPoint[] = [];
  private shapes: CustomGeometryQuery[] = [];
  private markers: Marker[] = [];

  private fill = false;
  private shapeColor: ColorDef = ColorDef.fromTbgr(ColorDef.withTransparency(ColorDef.create(ColorByName.cyan).tbgr, 200));
  private pointColor: ColorDef = ColorDef.white;
  private lineColor: ColorDef = ColorDef.red;
  private fillColor: ColorDef = ColorDef.white;
  private shapeThickness = 1;
  private pointThickness = 8;
  private lineThickness = 4;
  private edges = true;
  private linePixels = LinePixels.Solid;

  /** Clear the current context. */
  public clearContext(): void {
    this.points = [];
    this.shapes = [];
    this.markers = [];
    this.graphics = undefined;
    IModelApp.viewManager.invalidateDecorationsAllViews();
  }

  /** Set the active instance used by the decorator. */
  public async setContext(instanceId: string): Promise<boolean> {
    // Read spatial extents from SpatialIndex. Some element classes don't expose placement fields through ECSQL.
    const query = `SELECT minX,minY,minZ,maxX,maxY,maxZ FROM BisCore.SpatialIndex WHERE ECInstanceId = ?`;

    if (!IModelApp.viewManager.selectedView || !IModelApp.viewManager.selectedView.iModel) {
      return false;
    }

    const params = new QueryBinder().bindId(1, instanceId);
    const reader = IModelApp.viewManager.selectedView.iModel.createQueryReader(query, params, { rowFormat: QueryRowFormat.UseECSqlPropertyIndexes });
    const rows = await reader.toArray();
    if (rows.length !== 1) {
      // TODO: maybe report a warning or something
      return false;
    }

    const row = rows[0] as unknown;
    const minX = this.readNumber(row, 0, "minX");
    const minY = this.readNumber(row, 1, "minY");
    const minZ = this.readNumber(row, 2, "minZ");
    const maxX = this.readNumber(row, 3, "maxX");
    const maxY = this.readNumber(row, 4, "maxY");
    const maxZ = this.readNumber(row, 5, "maxZ");

    if (minX === undefined || minY === undefined || minZ === undefined || maxX === undefined || maxY === undefined || maxZ === undefined) {
      return false;
    }

    const elem: SpatialElementQueryResult = {
      bBoxHigh: Point3d.create(maxX, maxY, maxZ),
      bBoxLow: Point3d.create(minX, minY, minZ),
      // SpatialIndex stores world-aligned extents only. Build an axis-aligned placement.
      yaw: 0,
      pitch: 0,
      roll: 0,
      origin: Point3d.createZero(),
    };

    if (!this.validateQueryResult(elem)) {
      return false;
    } else {
      this.instance = this.inferSpatialData(elem);
      return true;
    }
  }

  /** Get the calculated spatial lengths for all possible dimensions. */
  public getInferredSpatialData(): Map<BboxDimension, number> | undefined {
    if (!this.instance) {
      return;
    }

    // calculate each dimension
    const data = new Map<BboxDimension, number>();
    const corners = this.instance.placement.getWorldCorners().points;
    const mappings = this.instance.pointMappings;
    for (const dimKey in BboxDimension) {
      if (!Object.prototype.hasOwnProperty.call(BboxDimension, dimKey)) continue;
      const dim = BboxDimension[dimKey as keyof typeof BboxDimension];
      if (mappings.has(dim)) {
        const points = mappings.get(dim);
        if (points) {
          data.set(dim, corners[points[0]].distance(corners[points[1]]));
        }
      }
    }

    return data;
  }

  /** Command to draw the BBox. */
  public drawContext(dim: BboxDimension): boolean {
    // check if valid instance set
    if (!this.instance) {
      return false;
    }
    this.clearContext();

    // add geometry to decorator
    const polyface = this.buildPolyface(this.instance.placement.bbox, this.instance.placement.transform);
    this.addGeometry(polyface);
    const [line, points] = this.buildLine(this.instance.placement.bbox, dim, this.instance.placement.transform);
    this.addLine(line);
    this.addPoints(points);

    return true;
  }

  /** Generates new graphics if needed, and adds them to the scene. */
  public decorate(context: DecorateContext): void {
    // const overrides = new ViewFlagOverrides();
    // overrides.setShowVisibleEdges(true);
    // overrides.setApplyLighting(true);
    const branch = new GraphicBranch(false);

    // branch.viewFlagOverrides.copyFrom(overrides);

    // context.viewFlags.visibleEdges = true;
    if (!this.graphics) {
      this.graphics = this.createGraphics(context);
    }

    if (this.graphics) {
      branch.add(this.graphics);
    }

    const graphic = context.createBranch(branch, Transform.identity);
    context.addDecoration(GraphicType.WorldOverlay, graphic);

    this.markers.forEach((marker) => {
      marker.addDecoration(context);
    });
  }

  // #region Helper Functions

  /** Calculate all BBox dimensions and properties and save. */
  private inferSpatialData(elem: SpatialElementQueryResult): InferredSpatialData {
    // build placement from result
    const origin = new Point3d(elem.origin.x, elem.origin.y, elem.origin.z);
    const bBoxLow = new Point3d(elem.bBoxLow.x, elem.bBoxLow.y, elem.bBoxLow.z);
    const bBoxHigh = new Point3d(elem.bBoxHigh.x, elem.bBoxHigh.y, elem.bBoxHigh.z);
    const range = Range3d.create(bBoxLow, bBoxHigh);
    const ypra = new YawPitchRollAngles(Angle.createDegrees(elem.yaw), Angle.createDegrees(elem.pitch), Angle.createDegrees(elem.roll));
    const placement = new Placement3d(origin, ypra, range);

    // determine dimension size ordering
    const pointMappings = new Map<BboxDimension, [number, number]>();
    pointMappings.set(BboxDimension.BoundingBoxDiagonalLength, [0, 7]);
    const corners = placement.getWorldCorners();
    const d01 = corners.distance(0, 1);
    const d02 = corners.distance(0, 2);
    const d04 = corners.distance(0, 4);
    if (d01 >= d02 && d02 >= d04) {
      pointMappings.set(BboxDimension.BoundingBoxLongestEdgeLength, [0, 1]);
      pointMappings.set(BboxDimension.BoundingBoxIntermediateEdgeLength, [0, 2]);
      pointMappings.set(BboxDimension.BoundingBoxShortestEdgeLength, [0, 4]);
      pointMappings.set(BboxDimension.BoundingBoxLongestFaceDiagonalLength, [0, 3]);
      pointMappings.set(BboxDimension.BoundingBoxIntermediateFaceDiagonalLength, [0, 5]);
      pointMappings.set(BboxDimension.BoundingBoxShortestFaceDiagonalLength, [0, 6]);
    } else if (d01 >= d04 && d04 >= d02) {
      pointMappings.set(BboxDimension.BoundingBoxLongestEdgeLength, [0, 1]);
      pointMappings.set(BboxDimension.BoundingBoxIntermediateEdgeLength, [0, 4]);
      pointMappings.set(BboxDimension.BoundingBoxShortestEdgeLength, [0, 2]);
      pointMappings.set(BboxDimension.BoundingBoxLongestFaceDiagonalLength, [0, 5]);
      pointMappings.set(BboxDimension.BoundingBoxIntermediateFaceDiagonalLength, [0, 3]);
      pointMappings.set(BboxDimension.BoundingBoxShortestFaceDiagonalLength, [0, 6]);
    } else if (d04 >= d02 && d02 >= d01) {
      pointMappings.set(BboxDimension.BoundingBoxLongestEdgeLength, [0, 4]);
      pointMappings.set(BboxDimension.BoundingBoxIntermediateEdgeLength, [0, 2]);
      pointMappings.set(BboxDimension.BoundingBoxShortestEdgeLength, [0, 1]);
      pointMappings.set(BboxDimension.BoundingBoxLongestFaceDiagonalLength, [0, 6]);
      pointMappings.set(BboxDimension.BoundingBoxIntermediateFaceDiagonalLength, [0, 5]);
      pointMappings.set(BboxDimension.BoundingBoxShortestFaceDiagonalLength, [0, 3]);
    } else if (d04 >= d01 && d01 >= d02) {
      pointMappings.set(BboxDimension.BoundingBoxLongestEdgeLength, [0, 4]);
      pointMappings.set(BboxDimension.BoundingBoxIntermediateEdgeLength, [0, 1]);
      pointMappings.set(BboxDimension.BoundingBoxShortestEdgeLength, [0, 2]);
      pointMappings.set(BboxDimension.BoundingBoxLongestFaceDiagonalLength, [0, 5]);
      pointMappings.set(BboxDimension.BoundingBoxIntermediateFaceDiagonalLength, [0, 6]);
      pointMappings.set(BboxDimension.BoundingBoxShortestFaceDiagonalLength, [0, 3]);
    } else if (d02 >= d01 && d01 >= d04) {
      pointMappings.set(BboxDimension.BoundingBoxLongestEdgeLength, [0, 2]);
      pointMappings.set(BboxDimension.BoundingBoxIntermediateEdgeLength, [0, 1]);
      pointMappings.set(BboxDimension.BoundingBoxShortestEdgeLength, [0, 4]);
      pointMappings.set(BboxDimension.BoundingBoxLongestFaceDiagonalLength, [0, 3]);
      pointMappings.set(BboxDimension.BoundingBoxIntermediateFaceDiagonalLength, [0, 6]);
      pointMappings.set(BboxDimension.BoundingBoxShortestFaceDiagonalLength, [0, 5]);
    } else if (d02 >= d04 && d04 >= d01) {
      pointMappings.set(BboxDimension.BoundingBoxLongestEdgeLength, [0, 2]);
      pointMappings.set(BboxDimension.BoundingBoxIntermediateEdgeLength, [0, 4]);
      pointMappings.set(BboxDimension.BoundingBoxShortestEdgeLength, [0, 1]);
      pointMappings.set(BboxDimension.BoundingBoxLongestFaceDiagonalLength, [0, 6]);
      pointMappings.set(BboxDimension.BoundingBoxIntermediateFaceDiagonalLength, [0, 3]);
      pointMappings.set(BboxDimension.BoundingBoxShortestFaceDiagonalLength, [0, 5]);
    } else {
      // Unreachable case
    }

    return { placement, pointMappings };
  }

  /** Validate if instance has all necessary properties. */
  private validateQueryResult(result: SpatialElementQueryResult): boolean {
    if (
      result?.bBoxHigh?.x !== undefined &&
      result?.bBoxHigh.y !== undefined &&
      result?.bBoxHigh.z !== undefined &&
      result?.bBoxLow?.x !== undefined &&
      result?.bBoxLow.y !== undefined &&
      result?.bBoxLow.z !== undefined &&
      result?.origin?.x !== undefined &&
      result?.origin.y !== undefined &&
      result?.origin.z !== undefined &&
      result?.yaw !== undefined &&
      result?.pitch !== undefined &&
      result?.roll !== undefined
    ) {
      return true;
    }
    return false;
  }

  private readNumber(row: unknown, index: number, key: string): number | undefined {
    if (Array.isArray(row)) {
      return this.asNumber(row[index]);
    }
    if (!row || typeof row !== "object") {
      return undefined;
    }
    const valueByIndex = (row as Record<number, unknown>)[index];
    if (valueByIndex !== undefined) {
      return this.asNumber(valueByIndex);
    }
    const valueByStringIndex = (row as Record<string, unknown>)[String(index)];
    if (valueByStringIndex !== undefined) {
      return this.asNumber(valueByStringIndex);
    }
    const value = (row as Record<string, unknown>)[key];
    if (value !== undefined) {
      return this.asNumber(value);
    }
    const keyLower = key.toLowerCase();
    for (const [rowKey, rowValue] of Object.entries(row)) {
      if (rowKey.toLowerCase() === keyLower) {
        return this.asNumber(rowValue);
      }
    }
    return undefined;
  }

  private asNumber(value: unknown): number | undefined {
    if (typeof value === "number" && Number.isFinite(value)) {
      return value;
    }
    if (typeof value === "string") {
      const parsed = Number(value);
      if (Number.isFinite(parsed)) {
        return parsed;
      }
    }
    return undefined;
  }

  /**
   * Takes a Bounding Box and builds a rectangular polyface.
   * @param bbox The desired Bounding Box.
   * @param tf Transformation on the Bounding Box if applicable.
   * @returns The bounding box geometry.
   */
  private buildPolyface(bbox: Range3d, tf: Transform): IndexedPolyface {
    const options = StrokeOptions.createForCurves();
    options.needParams = false;
    options.needNormals = true;
    const builder = PolyfaceBuilder.create(options);
    const box = Box.createRange(bbox, true)?.cloneTransformed(tf);
    if (box) {
      builder.addBox(box);
    }
    return builder.claimPolyface(false);
  }

  /**
   * Build a Lone geometry based on specified dimension.
   * @param bbox The desired Bounding Box.
   * @param dim The desired dimension to draw.
   * @param tf Transformation on the Bounding Box if applicable.
   * @returns The line geometry.
   */
  private buildLine(bbox: Range3d, dim: BboxDimension, tf: Transform): [CurvePrimitive, Point3d[]] {
    // fallback scenario
    const fallback: [CurvePrimitive, Point3d[]] = [LineSegment3d.create(bbox.low, bbox.high).cloneTransformed(tf), [bbox.low, bbox.high]];
    if (!this.instance) {
      // TODO: probably should have some warning here...
      return fallback;
    }

    // otherwise return appropriate dimensions
    const corners = this.instance.placement.getWorldCorners().points;
    const targets = this.instance.pointMappings.get(dim);
    if (targets) {
      return [LineSegment3d.create(corners[targets[0]], corners[targets[1]]), [corners[targets[0]], corners[targets[1]]]];
    } else {
      // TODO: probably should have some warning here...
      return fallback;
    }
  }

  /**
   * Configure and add points to the dectorator.
   * @param point Definition of the points.
   */
  public addPoints(points: Point3d[]) {
    for (const point of points) {
      const styledPoint: CustomPoint = {
        point,
        color: this.pointColor,
        fill: this.fill,
        lineThickness: this.pointThickness,
      };
      this.points.push(styledPoint);
    }
  }

  /**
   * Configure and add a line to the decorator.
   * Length of the line is displayed as a label in the center.
   * @param line Definition of the line.
   */
  private addLine(line: LineSegment3d | CurvePrimitive) {
    const styledGeometry: CustomGeometryQuery = {
      geometry: line,
      color: this.lineColor,
      fill: true,
      fillColor: this.fillColor,
      lineThickness: this.lineThickness,
      edges: this.edges,
      linePixels: this.linePixels,
    };
    this.shapes.push(styledGeometry);

    const marker = new Marker(line.fractionToPoint(0.5), { x: 25, y: 25 });
    const label: HTMLDivElement = document.createElement("div");
    label.textContent = `${line.quickLength().toFixed(3)}m`;
    label.style.backgroundColor = "rgba(17,17,17,0.75)";
    label.style.borderRadius = "4px";
    label.style.color = "white";
    label.style.padding = "4px 8px";
    marker.htmlElement = label;
    marker.visible = true;
    this.markers.push(marker);
  }

  /**
   * Configure and add a mesh to the decorator.
   * @param geometry Definition of the mesh.
   */
  private addGeometry(geometry: GeometryQuery) {
    const styledGeometry: CustomGeometryQuery = {
      geometry,
      color: this.shapeColor,
      fill: this.fill,
      fillColor: this.fillColor,
      lineThickness: this.shapeThickness,
      edges: this.edges,
      linePixels: this.linePixels,
    };
    this.shapes.push(styledGeometry);
  }

  /**
   * Iterate through the geometry and point lists, extracting each geometry and point, along with their styles
   * Adding them to the graphic builder which then creates new graphics
   * @param context
   * @returns
   */
  private createGraphics(context: DecorateContext): RenderGraphic | undefined {
    // Specifying an Id for the graphics tells the display system that all of the geometry belongs to the same entity, so that it knows to make sure the edges draw on top of the surfaces.
    const builder = context.createGraphicBuilder(GraphicType.Scene, undefined, context.viewport.iModel.transientIds.getNext());
    // Read-only now
    // builder.wantNormals = true;
    this.points.forEach((styledPoint) => {
      builder.setSymbology(styledPoint.color, styledPoint.fill ? styledPoint.color : ColorDef.white, styledPoint.lineThickness);
      const point = styledPoint.point;
      builder.addPointString([point]);
    });
    this.shapes.forEach((styledGeometry) => {
      const geometry = styledGeometry.geometry;
      builder.setSymbology(
        styledGeometry.color,
        styledGeometry.fill ? styledGeometry.fillColor : styledGeometry.color,
        styledGeometry.lineThickness,
        styledGeometry.linePixels,
      );
      this.createGraphicsForGeometry(geometry, styledGeometry.edges, builder);
    });
    const graphic = builder.finish();
    return graphic;
  }
  private createGraphicsForGeometry(geometry: GeometryQuery, wantEdges: boolean, builder: GraphicBuilder) {
    if (geometry instanceof LineString3d) {
      builder.addLineString(geometry.points);
    } else if (geometry instanceof Loop) {
      builder.addLoop(geometry);
      if (wantEdges) {
        // Since decorators don't natively support visual edges,
        // We draw them manually as lines along each loop edge/arc
        builder.setSymbology(ColorDef.black, ColorDef.black, 2);
        const curves = geometry.children;
        curves.forEach((value) => {
          if (value instanceof LineString3d) {
            let edges = value.points;
            const endPoint = value.pointAt(0);
            if (endPoint) {
              edges = edges.concat([endPoint]);
            }
            builder.addLineString(edges);
          } else if (value instanceof Arc3d) {
            builder.addArc(value, false, false);
          }
        });
      }
    } else if (geometry instanceof Path) {
      builder.addPath(geometry);
    } else if (geometry instanceof IndexedPolyface) {
      builder.addPolyface(geometry, false);
      if (wantEdges) {
        // Since decorators don't natively support visual edges,
        // We draw them manually as lines along each facet edge
        builder.setSymbology(ColorDef.black, ColorDef.black, 2);
        const visitor = IndexedPolyfaceVisitor.create(geometry, 1);
        let flag = true;
        while (flag) {
          const numIndices = visitor.pointCount;
          for (let i = 0; i < numIndices - 1; i++) {
            const point1 = visitor.getPoint(i);
            const point2 = visitor.getPoint(i + 1);
            if (point1 && point2) {
              builder.addLineString([point1, point2]);
            }
          }
          flag = visitor.moveToNextFacet();
        }
      }
    } else if (geometry instanceof LineSegment3d) {
      const pointA = geometry.point0Ref;
      const pointB = geometry.point1Ref;
      const lineString = [pointA, pointB];
      builder.addLineString(lineString);
    } else if (geometry instanceof Arc3d) {
      builder.addArc(geometry, false, false);
    } else if (geometry instanceof CurveChainWithDistanceIndex) {
      this.createGraphicsForGeometry(geometry.path, wantEdges, builder);
    }
  }

  // #endregion
}
