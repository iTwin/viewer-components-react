/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import type { Id64String } from "@itwin/core-bentley";
import type { XYZProps } from "@itwin/core-geometry";
import { GraphicType, IModelApp, QuantityType } from "@itwin/core-frontend";
import { Geometry, IModelJson, Point3d, PointString3d, PolygonOps, Transform } from "@itwin/core-geometry";
import { FormatterUtils } from "../api/FormatterUtils.js";
import { StyleSet, WellKnownGraphicStyleType } from "../api/GraphicStyle.js";
import { Measurement, MeasurementPickContext, MeasurementSerializer } from "../api/Measurement.js";
import { MeasurementPropertyHelper } from "../api/MeasurementPropertyHelper.js";
import { MeasurementSelectionSet } from "../api/MeasurementSelectionSet.js";
import { Polygon } from "../api/Polygon.js";
import { MeasureTools } from "../MeasureTools.js";
import { DistanceMeasurement } from "./DistanceMeasurement.js";

import type { GeometryStreamProps } from "@itwin/core-common";
import type {
  BeButtonEvent,
  DecorateContext,
  GraphicBuilder,
  RenderGraphicOwner,
} from "@itwin/core-frontend";
import type {
  DrawingMetadataProps,
  MeasurementEqualityOptions,
  MeasurementWidgetData,
} from "../api/Measurement.js";
import type { MeasurementFormattingProps, MeasurementProps } from "../api/MeasurementProps.js";
/**
 * Props for serializing a [[AreaMeasurement]].
 */
export interface AreaMeasurementProps extends MeasurementProps {
  polygonPoints: XYZProps[];
  formatting?: AreaMeasurementFormattingProps;
}

/** Formatting properties for area measurement. */
export interface AreaMeasurementFormattingProps {
  /** Defaults to "AecUnits.LENGTH" and "Units.M" */
  length?: MeasurementFormattingProps;
  /** Defaults to "AecUnits.AREA" and "Units.SQ_M" */
  area? : MeasurementFormattingProps;
}

/** Serializer for a [[AreaMeasurement]]. */
export class AreaMeasurementSerializer extends MeasurementSerializer {
  public static readonly areaMeasurementName = "areaMeasurement";

  public get measurementName(): string {
    return AreaMeasurementSerializer.areaMeasurementName;
  }

  public isValidType(measurement: Measurement): boolean {
    return measurement instanceof AreaMeasurement;
  }

  public override isValidJSON(json: any): boolean {
    if (
      !super.isValidJSON(json) ||
      !json.hasOwnProperty("polygonPoints") ||
      !Array.isArray(json.polygonPoints)
    )
      return false;

    return true;
  }

  protected parseSingle(data: MeasurementProps): Measurement | undefined {
    if (!this.isValidJSON(data)) return undefined;

    const props = data as AreaMeasurementProps;
    return AreaMeasurement.fromJSON(props);
  }
}

/**
 * Area measurement. A polygon with formatted area in a "text pill" at the center.
 */
export class AreaMeasurement extends Measurement {
  public static override readonly serializer = Measurement.registerSerializer(
    new AreaMeasurementSerializer()
  );

  private _polygon: Polygon;
  private _lengthKoQ: string;
  private _lengthPersistenceUnitName: string;
  private _areaKoQ: string;
  private _areaPersistenceUnitName: string;

  private _isDynamic: boolean; // No serialize, for dynamics
  private _dynamicEdge?: DistanceMeasurement; // No serialize, for dynamics

  private _cachedGraphic?: RenderGraphicOwner;

  public get isDynamic(): boolean {
    return this._isDynamic;
  }

  public set isDynamic(isDynamic: boolean) {
    this._isDynamic = isDynamic;
    this._polygon.makeSelectable(!isDynamic);
    this.clearCachedGraphics();
  }

  public get polygon(): Polygon {
    return this._polygon;
  }

  public get polygonPoints(): Point3d[] {
    return this._polygon.points;
  }

  public get isValidPolygon(): boolean {
    if (this.polygonPoints.length < 3) return false;

    const area = Math.abs(PolygonOps.area(this.polygonPoints));
    if (0 >= area) return false;

    return true;
  }

  public get lengthKoQ(): string {
    return this._lengthKoQ;
  }
  public set lengthKoQ(value: string) {
    this._lengthKoQ = value;
    this._polygon.recomputeFromPoints();
  }

  public get lengthPersistenceUnitName(): string {
    return this._lengthPersistenceUnitName;
  }
  public set lengthPersistenceUnitName(value: string) {
    this._lengthPersistenceUnitName = value;
    this._polygon.recomputeFromPoints();
  }

  public get areaKoQ(): string {
    return this._areaKoQ;
  }

  public set areaKoQ(value: string) {
    this._areaKoQ = value;
    this._polygon.recomputeFromPoints();
  }

  public get areaPersistenceUnitName(): string {
    return this._areaPersistenceUnitName;
  }

  public set areaPersistenceUnitName(value: string) {
    this._areaPersistenceUnitName = value;
    this._polygon.recomputeFromPoints();
  }

  constructor(props?: AreaMeasurementProps) {
    super(props);

    this._polygon = new Polygon([], false, undefined, props?.formatting?.area);
    this._polygon.textMarker.setMouseButtonHandler(
      this.handleTextMarkerButtonEvent.bind(this)
    );
    this._lengthKoQ = "AecUnits.LENGTH";
    this._lengthPersistenceUnitName = "Units.M";
    this._areaKoQ = "AecUnits.AREA";
    this._areaPersistenceUnitName = "Units.SQ_M";
    this._polygon.textMarker.transientHiliteId = this.transientId;
    this._polygon.makeSelectable(true);
    this._isDynamic = false;

    if (props) this.readFromJSON(props);

  }

  private handleTextMarkerButtonEvent(ev: BeButtonEvent): boolean {
    if (this.isDynamic) return false;

    void this.onDecorationButtonEvent(
      MeasurementPickContext.createFromSourceId("Invalid", ev)
    );

    return true;
  }

  public override async populateFormattingSpecsRegistry(_force?: boolean): Promise<void> {
    const lengthEntry = IModelApp.quantityFormatter.getSpecsByName(this._lengthKoQ);
    if (_force || !lengthEntry || lengthEntry.formatterSpec.persistenceUnit?.name !== this._lengthPersistenceUnitName) {
      const lengthFormatProps = await IModelApp.formatsProvider.getFormat(this._lengthKoQ);
      if (lengthFormatProps) {
        await IModelApp.quantityFormatter.addFormattingSpecsToRegistry(this._lengthKoQ, this._lengthPersistenceUnitName, lengthFormatProps);
      }
    }
    const areaEntry = IModelApp.quantityFormatter.getSpecsByName(this._areaKoQ);
    if (_force || !areaEntry || areaEntry.formatterSpec.persistenceUnit?.name !== this._areaPersistenceUnitName) {
      const areaFormatProps = await IModelApp.formatsProvider.getFormat(this._areaKoQ);
      if (areaFormatProps) {
        await IModelApp.quantityFormatter.addFormattingSpecsToRegistry(this._areaKoQ, this._areaPersistenceUnitName, areaFormatProps);
      }
    }
  }

  public addPointToDynamicPolygon(point: Point3d): boolean {
    if (!this.isDynamic) return false;

    // Ignore the point if it's the same as the last one
    if (
      this.polygonPoints.length > 0 &&
      this.polygonPoints[this.polygonPoints.length - 1].isAlmostEqual(point)
    )
      return false;

    this.polygonPoints.push(point.clone());
    this.clearCachedGraphics();

    // Check if we should close the polygon, if it's last and first points now equal
    if (
      this.polygonPoints.length > 2 &&
      this.polygonPoints[0].isAlmostEqual(
        this.polygonPoints[this.polygonPoints.length - 1]
      )
    ) {
      this.closeDynamicPolygon();
      return true;
    }

    return false;
  }

  public updateDynamicPolygon(point: Point3d): void {
    if (!this.isDynamic) return;

    const length = this.polygonPoints.length;
    if (length === 0) return;

    const drawingMetadata: DrawingMetadataProps | undefined = this.drawingMetadata !== undefined ? { origin: this.drawingMetadata.origin, sheetToWorldTransformProps: this.drawingMetadata.sheetToWorldTransformProps }: undefined

    const start = this.polygonPoints[length - 1];
    this._dynamicEdge = new DistanceMeasurement({startPoint: start, endPoint: point, formatting: { length: { koqName: this._lengthKoQ, persistenceUnitName: this._lengthPersistenceUnitName }}, drawingMetadata: drawingMetadata});

    this._dynamicEdge.sheetViewId = this.sheetViewId;
    this._dynamicEdge.viewTarget.copyFrom(this.viewTarget);
    this._dynamicEdge.style = this.style;
    this._dynamicEdge.lockStyle = this.lockStyle;
    this._dynamicEdge.isDynamic = true;
    this._dynamicEdge.showAxes = false;
    this._dynamicEdge.displayLabels = this.displayLabels;
    this._polygon.recomputeFromPoints();
  }

  public closeDynamicPolygon(): boolean {
    if (!this.isDynamic || !this.isValidPolygon) return false;

    const polyPoints = this.polygonPoints;
    const isClosedPath = polyPoints[0].isAlmostEqual(
      polyPoints[polyPoints.length - 1]
    );
    if (!isClosedPath) polyPoints.push(polyPoints[0].clone());

    this._polygon.recomputeFromPoints();
    this._dynamicEdge = undefined;
    this.isDynamic = false;
    return true;
  }

  public override testDecorationHit(
    pickContext: MeasurementPickContext
  ): boolean {
    if (this.transientId && this.transientId === pickContext.geomId)
      return true;

    if (pickContext.buttonEvent && this.displayLabels)
      return this._polygon.textMarker.pick(pickContext.buttonEvent.viewPoint);

    return false;
  }

  public override getDecorationGeometry(
    _pickContext: MeasurementPickContext
  ): GeometryStreamProps | undefined {
    if (this.polygonPoints.length === 0) return undefined;

    // If dynamic, only want to return the first snap point, because as we're laying out a dynamic polygon we want to be able to snap to itself at the first point
    if (this.isDynamic) {
      if (this.polygonPoints.length >= 3)
        return [
          IModelJson.Writer.toIModelJson(
            PointString3d.create(this.polygonPoints[0])
          ),
        ];

      return undefined;
    }

    return [
      IModelJson.Writer.toIModelJson(PointString3d.create(this.polygonPoints)),
    ];
  }

  public override async getDecorationToolTip(
    _pickContext: MeasurementPickContext
  ): Promise<HTMLElement | string> {
    if (this.isDynamic)
      return MeasureTools.localization.getLocalizedString(
        "MeasureTools:Measurements.closePolygon"
      );

    return MeasureTools.localization.getLocalizedString(
      "MeasureTools:Measurements.areaMeasurement"
    );
  }

  private getSnapId(): string | undefined {
    if (!this.transientId)
      this.transientId = MeasurementSelectionSet.nextTransientId;

    // We participate even during dynamics, so we can snap to the first point to close. But it only makes sense to do so if there are 3 or more points.
    if (this.isDynamic && this.polygonPoints.length < 3) return undefined;

    return this.transientId;
  }

  protected clearCachedGraphics() {
    if (this._cachedGraphic) {
      this._cachedGraphic.disposeGraphic();
      this._cachedGraphic = undefined;
    }
  }

  public override onCleanup() {
    this.clearCachedGraphics();
  }

  protected override onTransientIdChanged(_prevId: Id64String) {
    this._polygon.textMarker.transientHiliteId = this.transientId;
    this.clearCachedGraphics();
  }

  private addDynamicSnapGraphic(
    styleSet: StyleSet,
    context: DecorateContext
  ): void {
    if (!this.isDynamic || this.polygonPoints.length === 0) return;

    // Add a graphic just for snapping to the first point if we can
    const firstPtSnapId = this.getSnapId();
    if (firstPtSnapId === undefined) return;

    const builder = context.createGraphicBuilder(
      GraphicType.WorldOverlay,
      undefined,
      firstPtSnapId
    );

    // Make sure it's the same symbology as the polygon drawing code
    const style = styleSet
      .getGraphicStyle(WellKnownGraphicStyleType.AreaMeasurementDynamic)!
      .clone();
    style.lineWidth += 11;
    style.addStyledPointString(builder, [this.polygonPoints[0]], false);
    context.addDecorationFromBuilder(builder);
  }

  public override onDrawingMetadataChanged(): void {
    this.polygon.sheetToWorldTransform = this.drawingMetadata?.sheetToWorldTransformv2 ?? Transform.createIdentity();
    this._polygon.recomputeFromPoints();
  }

  public override decorate(context: DecorateContext): void {
    super.decorate(context);

    if (this.polygonPoints.length === 0)
      return;

    const styleTheme = StyleSet.getOrDefault(this.activeStyle);
    const snapId = !this.isDynamic ? this.getSnapId() : undefined;

    if (this.isDynamic) {
      this.addDynamicSnapGraphic(styleTheme, context);

      if (this._dynamicEdge) this._dynamicEdge.decorate(context);

      const dynamicGBuilde = context.createGraphicBuilder(
        GraphicType.WorldOverlay
      );
      this.drawDynamicArea(styleTheme, dynamicGBuilde);
      context.addDecorationFromBuilder(dynamicGBuilde);

      if (!this._cachedGraphic) {
        const polygonGBuilder = context.createGraphicBuilder(
          GraphicType.WorldOverlay
        );
        this.drawDynamicPolygonShape(styleTheme, polygonGBuilder);
        this._cachedGraphic = IModelApp.renderSystem.createGraphicOwner(
          polygonGBuilder.finish()
        );
      }
    } else {
      if (!this._cachedGraphic) {
        const polygonGBuilder = context.createGraphicBuilder(
          GraphicType.WorldOverlay,
          undefined,
          snapId
        );
        this._polygon.addToGraphicBuilder(polygonGBuilder);
        this._cachedGraphic = IModelApp.renderSystem.createGraphicOwner(
          polygonGBuilder.finish()
        );
      }
    }

    if (this._cachedGraphic)
      context.addDecoration(GraphicType.WorldOverlay, this._cachedGraphic);

    if (0.0 < this._polygon.area && this.displayLabels)
      this._polygon.drawTextMarker(context);
  }

  private drawDynamicArea(
    styleSet: StyleSet,
    graphicBuilder: GraphicBuilder
  ): void {
    if (
      !this._dynamicEdge ||
      this.polygonPoints.length === 0 ||
      !this.polygon.drawFillArea
    )
      return;

    const first = this.polygonPoints[0];
    const last = this._dynamicEdge.startPointRef;
    const dynamic = this._dynamicEdge.endPointRef;
    const pointsOnTemporaryShape = [first, last, dynamic];
    const style = styleSet.getGraphicStyle(
      WellKnownGraphicStyleType.AreaMeasurementDynamic
    )!;
    style.addStyledShape(graphicBuilder, pointsOnTemporaryShape, false);
  }

  private drawDynamicPolygonShape(
    styleSet: StyleSet,
    graphicBuilder: GraphicBuilder
  ): void {
    if (this.polygonPoints.length === 0) return;

    // If drawing with fill, use the dynamic style. If not, use the regular style since it'll just be the outline (by default dynamic is lighter in color/transparency)
    const outlineStyleType = this.polygon.drawFillArea
      ? WellKnownGraphicStyleType.AreaMeasurementDynamic
      : WellKnownGraphicStyleType.AreaMeasurement;
    const style = styleSet.getGraphicStyle(outlineStyleType)!;
    style.addStyledPointString(graphicBuilder, this.polygonPoints, false);
    style.addStyledLineString(graphicBuilder, this.polygonPoints, false);

    if (this.polygon.drawFillArea) {
      const style2 = styleSet.getGraphicStyle(
        WellKnownGraphicStyleType.AreaMeasurement
      )!;
      style2.addStyledShape(graphicBuilder, this.polygonPoints, false);
    }
  }

  protected override async getDataForMeasurementWidgetInternal(): Promise<MeasurementWidgetData> {
    const lengthSpec = FormatterUtils.getFormatterSpecWithFallback(this._lengthKoQ, QuantityType.LengthEngineering);
    const areaSpec = FormatterUtils.getFormatterSpecWithFallback(this._areaKoQ, QuantityType.Area);

    const fPerimeter = await FormatterUtils.formatLength(
      this._polygon.perimeter,
      lengthSpec
    );
    const fArea = await FormatterUtils.formatArea(
      this._polygon.area,
      areaSpec
    );
    const fAreaXY = await FormatterUtils.formatArea(
      this._polygon.areaXY,
      areaSpec
    );
    const fEdgeCount = (this._polygon.points.length - 1).toFixed();

    let title = MeasureTools.localization.getLocalizedString(
      "MeasureTools:Measurements.areaMeasurement"
    );
    title += ` [${fArea}]`;

    const data: MeasurementWidgetData = { title, properties: [] };
    MeasurementPropertyHelper.tryAddNameProperty(this, data.properties);

    data.properties.push(
      {
        label: MeasureTools.localization.getLocalizedString(
          "MeasureTools:tools.MeasureArea.popupArea"
        ),
        name: "AreaMeasurement_Area",
        value: fArea,
        aggregatableValue:
          areaSpec !== undefined
            ? { value: this._polygon.area, formatSpec: areaSpec }
            : undefined,
      }
    );

    if (this.drawingMetadata?.sheetToWorldTransformProps?.sheetScale === undefined) {
      data.properties.push(
        {
          label: MeasureTools.localization.getLocalizedString(
            "MeasureTools:tools.MeasureArea.popupAreaXY"
          ),
          name: "AreaMeasurement_AreaXY",
          value: fAreaXY,
          aggregatableValue:
            areaSpec !== undefined
              ? { value: this._polygon.areaXY, formatSpec: areaSpec }
              : undefined,
        }
      );
    }

    data.properties.push(
      {
        label: MeasureTools.localization.getLocalizedString(
          "MeasureTools:tools.MeasureArea.popupPerimeter"
        ),
        name: "AreaMeasurement_Perimeter",
        value: fPerimeter,
      },
      {
        label: MeasureTools.localization.getLocalizedString(
          "MeasureTools:tools.MeasureArea.popupEdgeCount"
        ),
        name: "AreaMeasurement_EdgeCount",
        value: fEdgeCount,
      }
    );

    return data;
  }

  protected override onStyleChanged(isLock: boolean, _prevStyle: string) {
    // Make sure polygon uses the active style
    this._polygon.styleSet = StyleSet.getOrDefault(this.activeStyle);
    this.clearCachedGraphics();

    // Copy the style to the dynamic edge
    if (!this._dynamicEdge) return;

    if (isLock) this._dynamicEdge.lockStyle = this.lockStyle;
    else this._dynamicEdge.style = this.style;
  }

  protected override onDisplayLabelsToggled() {
    if (this._dynamicEdge) this._dynamicEdge.displayLabels = this.displayLabels;
  }

  protected override onLockToggled() {
    this._polygon.styleSet = StyleSet.getOrDefault(this.activeStyle);
    this.clearCachedGraphics();
  }

  public override onDisplayUnitsChanged(): void {
    this._polygon.recomputeFromPoints();
  }

  /**
   * Tests equality with another measurement.
   * @param other Measurement to test equality for.
   * @param opts Options for equality testing.
   * @returns true if the other measurement is equal, false if some property is not the same or if the measurement is not of the same type.
   */
  public override equals(
    other: Measurement,
    opts?: MeasurementEqualityOptions
  ): boolean {
    if (!super.equals(other, opts)) return false;

    // Compare data (ignore isDynamic)
    const tol =
      opts && opts.tolerance !== undefined
        ? opts.tolerance
        : Geometry.smallMetricDistance;
    const otherArea = other as AreaMeasurement;
    if (
      otherArea === undefined ||
      this.polygonPoints.length !== otherArea.polygonPoints.length
    )
      return false;

    const thisPts = this.polygonPoints;
    const otherPts = otherArea.polygonPoints;

    for (let i = 0; i < thisPts.length; i++) {
      const thisPt = thisPts[i];
      const otherPt = otherPts[i];

      if (!thisPt.isAlmostEqual(otherPt, tol)) return false;
    }

    return true;
  }

  /**
   * Copies data from the other measurement into this instance.
   * @param other Measurement to copy property values from.
   */
  protected override copyFrom(other: Measurement) {
    super.copyFrom(other);

    if (other instanceof AreaMeasurement) {
      this.polygon.setPoints(other.polygonPoints, true, true);
      this.isDynamic = other.isDynamic;

      if (this.isDynamic && other._dynamicEdge)
        this.updateDynamicPolygon(other._dynamicEdge.endPointRef);
    }
  }

  /**
   * Deserializes properties (if they exist) from the JSON object.
   * @param json JSON object to read data from.
   */
  protected override readFromJSON(json: MeasurementProps) {
    super.readFromJSON(json);

    const jsonArea = json as AreaMeasurementProps;
    if (jsonArea.formatting?.area?.koqName) {
      this._areaKoQ = jsonArea.formatting.area.koqName;
      this._polygon.areaKoQ = this._areaKoQ;
    }
    if (jsonArea.formatting?.area?.persistenceUnitName) {
      this._areaPersistenceUnitName = jsonArea.formatting.area.persistenceUnitName;
      this._polygon.areaPersistenceUnitName = this._areaPersistenceUnitName;
    }
    if (jsonArea.formatting?.length?.koqName) this._lengthKoQ = jsonArea.formatting.length.koqName;
    if (jsonArea.formatting?.length?.persistenceUnitName) this._lengthPersistenceUnitName = jsonArea.formatting.length.persistenceUnitName;
    if (jsonArea.polygonPoints !== undefined) {
      const pts = new Array<Point3d>();
      for (const pt of jsonArea.polygonPoints) pts.push(Point3d.fromJSON(pt));

      this._polygon.setPoints(pts, false, true);

      if (this.isDynamic && this._dynamicEdge)
        this.updateDynamicPolygon(this._dynamicEdge.endPointRef);
    }


  }

  /**
   * Serializes properties to a JSON object.
   * @param json JSON object to append data to.
   */
  protected override writeToJSON(json: MeasurementProps) {
    super.writeToJSON(json);

    const pts = new Array<XYZProps>();
    for (const pt of this.polygonPoints) pts.push(pt.toJSON());

    const jsonArea = json as AreaMeasurementProps;
    jsonArea.polygonPoints = pts;
    jsonArea.formatting = {
      length: {
        koqName: this._lengthKoQ,
        persistenceUnitName: this._lengthPersistenceUnitName,
      },
      area: {
        koqName: this._areaKoQ,
        persistenceUnitName: this._areaPersistenceUnitName,
      },
    };
  }

  public static create(pts: Point3d[], viewType?: string, formatting?: AreaMeasurementFormattingProps): AreaMeasurement {
    // Don't ned to serialize the points, will just work as is
    const measurement = new AreaMeasurement({ polygonPoints: pts, formatting });
    if (viewType) measurement.viewTarget.include(viewType);

    return measurement;
  }

  public static fromJSON(data: AreaMeasurementProps): AreaMeasurement {
    return new AreaMeasurement(data);
  }
}
