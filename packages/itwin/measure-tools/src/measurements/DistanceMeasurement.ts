/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import type { Id64String } from "@itwin/core-bentley";
import type { XYAndZ, XYZProps } from "@itwin/core-geometry";
import { GraphicType, IModelApp, QuantityType } from "@itwin/core-frontend";
import { Geometry, IModelJson, LineSegment3d, Point3d, PointString3d, Range1d, Ray3d, Vector3d } from "@itwin/core-geometry";
import { FormatterUtils } from "../api/FormatterUtils.js";
import { StyleSet, TextOffsetType, WellKnownGraphicStyleType, WellKnownTextStyleType } from "../api/GraphicStyle.js";
import { Measurement, MeasurementPickContext, MeasurementSerializer } from "../api/Measurement.js";
import { MeasurementManager } from "../api/MeasurementManager.js";
import { MeasurementPreferences, MeasurementPreferencesProperty } from "../api/MeasurementPreferences.js";
import { MeasurementPropertyHelper } from "../api/MeasurementPropertyHelper.js";
import { MeasurementSelectionSet } from "../api/MeasurementSelectionSet.js";
import { TextMarker } from "../api/TextMarker.js";
import { MeasureTools } from "../MeasureTools.js";

import type { GeometryStreamProps } from "@itwin/core-common";
import type { BeButtonEvent, DecorateContext } from "@itwin/core-frontend";
import type {
  MeasurementEqualityOptions,
  MeasurementWidgetData,
} from "../api/Measurement.js";
import type { MeasurementFormattingProps, MeasurementProps } from "../api/MeasurementProps.js";

/**
 * Props for serializing a [[DistanceMeasurement]].
 */
export interface DistanceMeasurementProps extends MeasurementProps {
  startPoint: XYZProps;
  endPoint: XYZProps;
  showAxes?: boolean;
  formatting?: DistanceMeasurementFormattingProps;
}

/** Formatting properties for distance measurement. */
export interface DistanceMeasurementFormattingProps {
  /** Defaults to "AecUnits.LENGTH" and "Units.M" */
  length?: MeasurementFormattingProps;
  /** Defaults to "RoadRailUnits.BEARING" and "Units.RAD" */
  bearing? : MeasurementFormattingProps;
  /** Defaults to "AecUnits.LENGTH_COORDINATE" and "Units.M" */
  coordinate?: MeasurementFormattingProps;
}

/** Serializer for a [[DistanceMeasurement]]. */
export class DistanceMeasurementSerializer extends MeasurementSerializer {
  public static readonly distanceMeasurementName = "distanceMeasurement";

  public get measurementName(): string {
    return DistanceMeasurementSerializer.distanceMeasurementName;
  }

  public isValidType(measurement: Measurement): boolean {
    return measurement instanceof DistanceMeasurement;
  }

  public override isValidJSON(json: any): boolean {
    if (
      !super.isValidJSON(json) ||
      !json.hasOwnProperty("startPoint") ||
      !json.hasOwnProperty("endPoint")
    )
      return false;

    return true;
  }

  protected parseSingle(data: MeasurementProps): Measurement | undefined {
    if (!this.isValidJSON(data)) return undefined;

    const props = data as DistanceMeasurementProps;
    return DistanceMeasurement.fromJSON(props);
  }
}

/**
 * Distance measurement. Composed of a line and a formatted distance in a "text pill" in the middle of the line.
 */
export class DistanceMeasurement extends Measurement {
  public static override readonly serializer = Measurement.registerSerializer(
    new DistanceMeasurementSerializer()
  );

  private _startPoint: Point3d;
  private _endPoint: Point3d;
  private _showAxes: boolean;
  private _lengthKoQ: string;
  private _lengthPersistenceUnitName: string;
  private _bearingKoQ?: string;
  private _bearingPersistenceUnitName?: string;
  private _coordinateKoQ: string;
  private _coordinatePersistenceUnitName: string;

  private _isDynamic: boolean; // No serialize
  private _textMarker?: TextMarker; // No serialize

  private _runRiseAxes: DistanceMeasurement[]; // No serialize.
  private _textStyleOverride?: WellKnownTextStyleType; // No serialize.
  private _graphicStyleOverride?: WellKnownGraphicStyleType; // No serialize.

  public get startPointRef(): Point3d {
    return this._startPoint;
  }
  public get endPointRef(): Point3d {
    return this._endPoint;
  }

  public get isDynamic(): boolean {
    return this._isDynamic;
  }
  public set isDynamic(v: boolean) {
    this._isDynamic = v;
    this._runRiseAxes.forEach(
      (axis: DistanceMeasurement) => (axis.isDynamic = v)
    );

    if (this._textMarker) this._textMarker.pickable = !v;
  }

  public get showAxes(): boolean {
    return this._showAxes;
  }
  public set showAxes(v: boolean) {
    this._showAxes = v;
  }

  public get lengthKoQ(): string {
    return this._lengthKoQ;
  }
  public set lengthKoQ(value: string) {
    this._lengthKoQ = value;
    this.createTextMarker().catch(); // eslint-disable-line @typescript-eslint/no-floating-promises
  }

  public get lengthPersistenceUnitName(): string {
    return this._lengthPersistenceUnitName;
  }
  public set lengthPersistenceUnitName(value: string) {
    this._lengthPersistenceUnitName = value;
    this.createTextMarker().catch(); // eslint-disable-line @typescript-eslint/no-floating-promises
  }

  public get bearingKoQ(): string | undefined {
    return this._bearingKoQ;
  }

  public set bearingKoQ(value: string) {
    this._bearingKoQ = value;
    this.createTextMarker().catch(); // eslint-disable-line @typescript-eslint/no-floating-promises
  }

  public get bearingPersistenceUnitName(): string | undefined {
    return this._bearingPersistenceUnitName;
  }

  public set bearingPersistenceUnitName(value: string) {
    this._bearingPersistenceUnitName = value;
    this.createTextMarker().catch(); // eslint-disable-line @typescript-eslint/no-floating-promises
  }

  public get coordinateKoQ(): string {
    return this._coordinateKoQ;
  }

  public set coordinateKoQ(value: string) {
    this._coordinateKoQ = value;
  }

  public get coordinatePersistenceUnitName(): string {
    return this._coordinatePersistenceUnitName;
  }

  public set coordinatePersistenceUnitName(value: string) {
    this._coordinatePersistenceUnitName = value;
  }

  // eslint-disable-next-line @typescript-eslint/naming-convention
  private get isAxis(): boolean {
    return (
      undefined !== this._textStyleOverride ||
      undefined !== this._graphicStyleOverride
    );
  }

  constructor(props?: DistanceMeasurementProps) {
    super(props);

    this._startPoint = Point3d.createZero();
    this._endPoint = Point3d.createZero();
    this._isDynamic = false;
    this._showAxes = MeasurementPreferences.current.displayMeasurementAxes;
    this._runRiseAxes = [];
    this._lengthKoQ = "AecUnits.LENGTH";
    this._lengthPersistenceUnitName = "Units.M";
    this._coordinateKoQ = "AecUnits.LENGTH_COORDINATE";
    this._coordinatePersistenceUnitName = "Units.M";

    if (props) this.readFromJSON(props);

    this.populateFormattingSpecsRegistry().then(() => this.createTextMarker().catch())
    .catch();
  }

  public setStartPoint(point: XYAndZ) {
    this._startPoint.setFrom(point);
    this.createTextMarker().catch(); // eslint-disable-line @typescript-eslint/no-floating-promises
    this.buildRunRiseAxes();
  }

  public setEndPoint(point: XYAndZ) {
    this._endPoint.setFrom(point);
    this.createTextMarker().catch(); // eslint-disable-line @typescript-eslint/no-floating-promises
    this.buildRunRiseAxes();
  }

  public setStartEndPoints(start: XYAndZ, end: XYAndZ) {
    this._startPoint.setFrom(start);
    this._endPoint.setFrom(end);
    this.createTextMarker().catch(); // eslint-disable-line @typescript-eslint/no-floating-promises
    this.buildRunRiseAxes();
  }

  private setupAxis(
    ovrGraphicStyle: WellKnownGraphicStyleType,
    ovrTextStyle: WellKnownTextStyleType,
    start: Point3d,
    end: Point3d
  ) {
    this._graphicStyleOverride = ovrGraphicStyle;
    this._textStyleOverride = ovrTextStyle;
    this._startPoint.setFrom(start);
    this._endPoint.setFrom(end);
  }

  public override async populateFormattingSpecsRegistry(_force?: boolean): Promise<void> {
    const lengthEntry = IModelApp.quantityFormatter.getSpecsByName(this._lengthKoQ);
    if (_force || !lengthEntry || lengthEntry.formatterSpec.persistenceUnit?.name !== this._lengthPersistenceUnitName) {
      const lengthFormatProps = await IModelApp.formatsProvider.getFormat(this._lengthKoQ);
      if (lengthFormatProps) {
        await IModelApp.quantityFormatter.addFormattingSpecsToRegistry(this._lengthKoQ, this._lengthPersistenceUnitName, lengthFormatProps);
      }
    }

    const coordinateEntry = IModelApp.quantityFormatter.getSpecsByName(this._coordinateKoQ);
    if (_force || !coordinateEntry || coordinateEntry.formatterSpec.persistenceUnit?.name !== this._coordinatePersistenceUnitName) {
      const coordinateFormatProps = await IModelApp.formatsProvider.getFormat(this._coordinateKoQ);
      if (coordinateFormatProps) {
        await IModelApp.quantityFormatter.addFormattingSpecsToRegistry(this._coordinateKoQ, this._coordinatePersistenceUnitName, coordinateFormatProps);
      }
    }
  }

  public override testDecorationHit(
    pickContext: MeasurementPickContext
  ): boolean {
    if (this.transientId && this.transientId === pickContext.geomId)
      return true;

    if (
      pickContext.buttonEvent &&
      this._textMarker &&
      this.displayLabels &&
      this._textMarker.pick(pickContext.buttonEvent.viewPoint)
    )
      return true;

    if (this._showAxes) {
      for (const axis of this._runRiseAxes) {
        if (axis.testDecorationHit(pickContext)) return true;
      }
    }

    return false;
  }

  public override getDecorationGeometry(
    pickContext: MeasurementPickContext
  ): GeometryStreamProps | undefined {
    const geometry = [
      IModelJson.Writer.toIModelJson(
        PointString3d.create(this._startPoint, this._endPoint)
      ),
    ];

    if (this._showAxes) {
      this._runRiseAxes.forEach((axis) => {
        const geom = axis.getDecorationGeometry(pickContext);
        if (geom) geometry.push(geom);
      });
    }

    return geometry;
  }

  public override async getDecorationToolTip(
    _pickContext: MeasurementPickContext
  ): Promise<HTMLElement | string> {
    return MeasureTools.localization.getLocalizedString(
      "MeasureTools:Measurements.distanceMeasurement"
    );
  }

  private getSnapId(): string | undefined {
    if (!this.transientId)
      this.transientId = MeasurementSelectionSet.nextTransientId;

    if (this.isDynamic) return undefined;

    return this.transientId;
  }

  protected override onTransientIdChanged(_prevId: Id64String) {
    this._runRiseAxes.forEach((axis) => (axis.transientId = this.transientId));

    if (this._textMarker) this._textMarker.transientHiliteId = this.transientId;
  }

  public override decorate(context: DecorateContext): void {
    super.decorate(context);

    const styleTheme = StyleSet.getOrDefault(this.activeStyle);
    const points = [this._startPoint, this._endPoint];

    const style = styleTheme.getGraphicStyle(
      this._graphicStyleOverride ||
      WellKnownGraphicStyleType.DistanceMeasurement
    )!;
    const xBuilder = context.createGraphicBuilder(
      GraphicType.WorldOverlay,
      undefined,
      this.getSnapId()
    );
    style.addStyledLineString(xBuilder, points, true);
    style.addStyledPointString(xBuilder, points, true);
    context.addDecorationFromBuilder(xBuilder);

    if (!this._textMarker || this._startPoint.isAlmostEqual(this._endPoint))
      return;

    const textLocation = this.calculateWorldTextLocation(context);
    if (undefined === textLocation)
      return;

    this._textMarker.worldLocation = textLocation;

    // Determine which side to place the text marker relative to its anchor point
    const vPoints = [this._startPoint.clone(), this._endPoint.clone()];
    context.viewport.worldToViewArray(vPoints);
    const v0 = Vector3d.createStartEnd(vPoints[1], vPoints[0]);
    v0.z = 0.0;
    v0.rotate90CCWXY(v0);
    v0.normalizeInPlace();
    const xMax = 0.65;
    const yMax = 0.9;
    const x = v0.x < 0 ? Math.max(v0.x, -xMax) : Math.min(v0.x, xMax);
    const y = v0.y < 0 ? Math.max(v0.y, -yMax) : Math.min(v0.y, yMax);
    this._textMarker.offset = { type: TextOffsetType.Percentage, x, y };

    if (this.displayLabels) this._textMarker.addDecoration(context);

    if (this._showAxes)
      this._runRiseAxes.forEach((axis) => axis.decorate(context));
  }

  /** Clamps the segment to the current view frustum and return its midpoint.
   * @remarks Returns undefined if the segment is entirely 'behind' the camera eye
   */
  private calculateWorldTextLocation(context: DecorateContext): Point3d | undefined {
    const clipFront = context.viewport.view.is3d() && context.viewport.view.isCameraOn;
    const clipPlanes = context.viewport.getWorldFrustum().getRangePlanes(clipFront, false, 0.0);
    const startIn = clipPlanes.isPointOnOrInside(this._startPoint, Geometry.smallMetricDistance);
    const endIn = clipPlanes.isPointOnOrInside(this._endPoint, Geometry.smallMetricDistance);

    if (startIn && endIn)
      return Point3d.createAdd2Scaled(this._startPoint, 0.5, this._endPoint, 0.5);

    const range = Range1d.createNull();
    let ray = Ray3d.createStartEnd(this._startPoint.clone(), this._endPoint);

    // Either start/end or BOTH are outside the clip planes. If nothing intersects, don't bother displaying anything.
    if (!clipPlanes.hasIntersectionWithRay(ray, range))
      return undefined;

    let clampedStartPoint = this._startPoint;
    let clampedEndPoint = this._endPoint;

    if (!endIn) {
      if (range.high < 0)
        return undefined;

      clampedEndPoint = ray.fractionToPoint(range.high);
    }

    if (!startIn) {
      ray = Ray3d.createStartEnd(this._endPoint.clone(), this._startPoint);
      if (!clipPlanes.hasIntersectionWithRay(ray, range) || range.high < 0)
        return undefined;

      clampedStartPoint = ray.fractionToPoint(range.high);
    }

    return Point3d.createAdd2Scaled(clampedStartPoint, 0.5, clampedEndPoint, 0.5);
  }

  private buildRunRiseAxes(): void {
    this._runRiseAxes = [];

    if (this.isAxis) return;

    // Run point
    const runPoint = this._endPoint.clone();
    runPoint.z = this._startPoint.z;

    // It"s irrelevant to draw the axes because we"re in 2D already.
    if (runPoint.isAlmostEqual(this._endPoint)) return;

    const lines: LineSegment3d[] = [
      LineSegment3d.create(this._endPoint, runPoint),
      LineSegment3d.create(runPoint, this._startPoint),
    ];
    const graphicStyles: WellKnownGraphicStyleType[] = [
      WellKnownGraphicStyleType.Rise,
      WellKnownGraphicStyleType.Run,
    ];
    const textStyles: WellKnownTextStyleType[] = [
      WellKnownTextStyleType.Rise,
      WellKnownTextStyleType.Run,
    ];

    for (let i = 0; i < 2; ++i) {
      const line = lines[i];
      const dm = new DistanceMeasurement();
      dm.setupAxis(
        graphicStyles[i],
        textStyles[i],
        line.point0Ref,
        line.point1Ref
      );
      dm.viewTarget.copyFrom(this.viewTarget);
      dm.isDynamic = this.isDynamic;
      dm.transientId = this.transientId;
      dm.displayLabels = this.displayLabels;
      this._runRiseAxes.push(dm);
    }

    // When all text markers are ready for display, trigger a refresh
    const promises = this._runRiseAxes.map(async (value: DistanceMeasurement) =>
      value.createTextMarker()
    ); // eslint-disable-line @typescript-eslint/no-floating-promises
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    Promise.all(promises)
      .then(() => {
        for (const axis of this._runRiseAxes) {
          if (axis._textMarker) {
            axis._textMarker.pickable = !this._isDynamic;
            axis._textMarker.transientHiliteId = this.transientId;
            axis._textMarker.setMouseButtonHandler(
              this.handleTextMarkerButtonEvent.bind(this)
            );
          }
        }

        if (this._showAxes)
          IModelApp.viewManager.invalidateDecorationsAllViews();
      })
      .catch();
  }

  protected override onStyleChanged(_isLock: boolean, _prevStyle: string) {
    this.updateMarkerStyle();
  }

  protected override onLockToggled() {
    this.updateMarkerStyle();
  }

  protected override onDisplayLabelsToggled() {
    for (const dm of this._runRiseAxes) dm.displayLabels = this.displayLabels;
  }

  public override onDisplayUnitsChanged(): void {
    this.createTextMarker().catch(); // eslint-disable-line @typescript-eslint/no-floating-promises
    this._runRiseAxes.forEach((axis: DistanceMeasurement) =>
      axis.onDisplayUnitsChanged()
    );

  }

  private updateMarkerStyle() {
    if (!this._textMarker) return;

    const styleTheme = StyleSet.getOrDefault(this.activeStyle);

    const tStyle = styleTheme.getTextStyle(
      this._textStyleOverride || WellKnownTextStyleType.DistanceMeasurement
    )!;
    this._textMarker.applyStyle(tStyle);
  }

  private async createTextMarker(): Promise<void> {
    const lengthSpec = IModelApp.quantityFormatter.getSpecsByName(this._lengthKoQ)?.formatterSpec;

    const distance = this._startPoint.distance(this._endPoint);
    const fDistance = await FormatterUtils.formatLength(
      distance * this.worldScale,
      lengthSpec
    );

    const midPoint = Point3d.createAdd2Scaled(
      this._startPoint,
      0.5,
      this._endPoint,
      0.5
    );
    const styleTheme = StyleSet.getOrDefault(this.activeStyle);

    const tStyle = styleTheme.getTextStyle(
      this._textStyleOverride || WellKnownTextStyleType.DistanceMeasurement
    )!;
    this._textMarker = TextMarker.createStyled([fDistance], midPoint, tStyle);
    this._textMarker.transientHiliteId = this.transientId;
    this._textMarker.pickable = !this.isDynamic;
    this._textMarker.setMouseButtonHandler(
      this.handleTextMarkerButtonEvent.bind(this)
    );
  }

  private handleTextMarkerButtonEvent(ev: BeButtonEvent): boolean {
    if (!this._isDynamic) {
      void this.onDecorationButtonEvent(
        MeasurementPickContext.createFromSourceId("Invalid", ev)
      );
    }

    return true;
  }

  protected override async getDataForMeasurementWidgetInternal(): Promise<MeasurementWidgetData> {

    const distance = this.worldScale * this._startPoint.distance(this._endPoint);
    const run = this.drawingMetadata?.worldScale !== undefined ? this.worldScale * Math.abs(this._endPoint.x - this._startPoint.x): this._startPoint.distanceXY(this._endPoint);
    const rise = this.drawingMetadata?.worldScale !== undefined ? this.worldScale * (this._endPoint.y - this._startPoint.y): this._endPoint.z - this._startPoint.z;
    const slope = 0.0 < run ? (100 * rise) / run : 0.0;

    const dx = Math.abs(this._endPoint.x - this._startPoint.x);
    const dy = Math.abs(this._endPoint.y - this._startPoint.y);
    const bearing = FormatterUtils.calculateBearing(this._endPoint.x - this._startPoint.x, this._endPoint.y - this._startPoint.y);
    const adjustedStart = this.adjustPointForGlobalOrigin(this._startPoint);
    const adjustedEnd = this.adjustPointForGlobalOrigin(this._endPoint);
    const lengthSpec = FormatterUtils.getFormatterSpecWithFallback(this._lengthKoQ, QuantityType.LengthEngineering);
    const coordinateSpec = FormatterUtils.getFormatterSpecWithFallback(this._coordinateKoQ, QuantityType.Coordinate);

    const fDistance = lengthSpec ? IModelApp.quantityFormatter.formatQuantity(distance, lengthSpec) : await FormatterUtils.formatLength(distance);
    const fStartCoords = FormatterUtils.formatCoordinatesImmediate(adjustedStart, coordinateSpec);
    const fEndCoords = FormatterUtils.formatCoordinatesImmediate(adjustedEnd, coordinateSpec);
    const fSlope = FormatterUtils.formatSlope(slope, true);
    const fRun = lengthSpec ? IModelApp.quantityFormatter.formatQuantity(run, lengthSpec) : await FormatterUtils.formatLength(run);
    const fDeltaX = lengthSpec ? IModelApp.quantityFormatter.formatQuantity(dx, lengthSpec) : await FormatterUtils.formatLength(dx);
    const fDeltaY = lengthSpec ? IModelApp.quantityFormatter.formatQuantity(dy, lengthSpec) : await FormatterUtils.formatLength(dy);
    const fRise = lengthSpec ? IModelApp.quantityFormatter.formatQuantity(rise, lengthSpec) : await FormatterUtils.formatLength(rise);

    let title = MeasureTools.localization.getLocalizedString(
      "MeasureTools:Measurements.distanceMeasurement"
    );
    title += ` [${fDistance}]`;

    const data: MeasurementWidgetData = { title, properties: [] };
    MeasurementPropertyHelper.tryAddNameProperty(this, data.properties);

    data.properties.push(
      {
        label: MeasureTools.localization.getLocalizedString(
          "MeasureTools:tools.MeasureDistance.distance"
        ),
        name: "DistanceMeasurement_Distance",
        value: fDistance,
        aggregatableValue:
          lengthSpec !== undefined
            ? { value: distance, formatSpec: lengthSpec }
            : undefined,
      },
      {
        label: MeasureTools.localization.getLocalizedString(
          "MeasureTools:tools.MeasureDistance.run"
        ),
        name: "DistanceMeasurement_Run",
        value: fRun,
        aggregatableValue:
          lengthSpec !== undefined
            ? { value: run, formatSpec: lengthSpec }
            : undefined,
      },
      {
        label: MeasureTools.localization.getLocalizedString(
          "MeasureTools:tools.MeasureDistance.rise"
        ),
        name: "DistanceMeasurement_Rise",
        value: fRise,
      },
      {
        label: MeasureTools.localization.getLocalizedString(
          "MeasureTools:tools.MeasureDistance.slope"
        ),
        name: "DistanceMeasurement_Slope",
        value: fSlope,
      },
    );
    if (this._bearingKoQ && this._bearingPersistenceUnitName) {
      const bearingSpec = await FormatterUtils.getBearingFormatterSpec(this._bearingKoQ, this._bearingPersistenceUnitName);
      const fBearing: string = IModelApp.quantityFormatter.formatQuantity(bearing, bearingSpec);
      data.properties.push({
        label: MeasureTools.localization.getLocalizedString(
          "MeasureTools:tools.MeasureDistance.bearing"
        ),
        name: "DistanceMeasurement_Bearing",
        value: fBearing,
      });
    }
    if (this.drawingMetadata?.worldScale === undefined) {
      data.properties.push(
        {
          label: MeasureTools.localization.getLocalizedString(
            "MeasureTools:tools.MeasureDistance.delta_x"
          ),
          name: "DistanceMeasurement_Dx",
          value: fDeltaX,
        },
        {
          label: MeasureTools.localization.getLocalizedString(
            "MeasureTools:tools.MeasureDistance.delta_y"
          ),
          name: "DistanceMeasurement_Dy",
          value: fDeltaY,
        },
        {
          label: MeasureTools.localization.getLocalizedString(
            "MeasureTools:tools.MeasureDistance.startCoordinates"
          ),
          name: "DistanceMeasurement_StartPoint",
          value: fStartCoords,
        },
        {
          label: MeasureTools.localization.getLocalizedString(
            "MeasureTools:tools.MeasureDistance.endCoordinates"
          ),
          name: "DistanceMeasurement_EndPoint",
          value: fEndCoords,
        }
      );
    }

    return data;
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
    const tol = opts ? opts.tolerance : undefined;
    const otherDist = other as DistanceMeasurement;
    if (
      otherDist === undefined ||
      !this._startPoint.isAlmostEqual(otherDist._startPoint, tol) ||
      !this._endPoint.isAlmostEqual(otherDist._endPoint, tol) ||
      this._showAxes !== otherDist._showAxes
    )
      return false;

    return true;
  }

  /**
   * Copies data from the other measurement into this instance.
   * @param other Measurement to copy property values from.
   */
  protected override copyFrom(other: Measurement) {
    super.copyFrom(other);

    if (other instanceof DistanceMeasurement) {
      this._isDynamic = other._isDynamic;
      this._showAxes = other._showAxes;
      this._startPoint.setFrom(other._startPoint);
      this._endPoint.setFrom(other._endPoint);
      this._lengthKoQ = other._lengthKoQ;
      this.buildRunRiseAxes();
      this.createTextMarker().catch(); // eslint-disable-line @typescript-eslint/no-floating-promises
    }
  }

  /**
   * Deserializes properties (if they exist) from the JSON object.
   * @param json JSON object to read data from.
   */
  protected override readFromJSON(json: MeasurementProps) {
    super.readFromJSON(json);

    const jsonDist = json as DistanceMeasurementProps;
    if (jsonDist.startPoint !== undefined)
      this._startPoint.setFromJSON(jsonDist.startPoint);

    if (jsonDist.endPoint !== undefined)
      this._endPoint.setFromJSON(jsonDist.endPoint);

    this._showAxes =
      jsonDist.showAxes !== undefined
        ? jsonDist.showAxes
        : MeasurementPreferences.current.displayMeasurementAxes;

    if (jsonDist.formatting?.length?.koqName) this._lengthKoQ = jsonDist.formatting.length.koqName;
    if (jsonDist.formatting?.length?.persistenceUnitName) this._lengthPersistenceUnitName = jsonDist.formatting.length.persistenceUnitName;
    if (jsonDist.formatting?.bearing?.koqName) this._bearingKoQ = jsonDist.formatting.bearing.koqName;
    if (jsonDist.formatting?.bearing?.persistenceUnitName) this._bearingPersistenceUnitName = jsonDist.formatting.bearing.persistenceUnitName;
    if (jsonDist.formatting?.coordinate?.koqName) this._coordinateKoQ = jsonDist.formatting.coordinate.koqName;
    if (jsonDist.formatting?.coordinate?.persistenceUnitName) this._coordinatePersistenceUnitName = jsonDist.formatting.coordinate.persistenceUnitName;

    this.buildRunRiseAxes();
    this.createTextMarker().catch(); // eslint-disable-line @typescript-eslint/no-floating-promises
  }

  /**
   * Serializes properties to a JSON object.
   * @param json JSON object to append data to.
   */
  protected override writeToJSON(json: MeasurementProps) {
    super.writeToJSON(json);

    const jsonDist = json as DistanceMeasurementProps;
    jsonDist.startPoint = this._startPoint.toJSON();
    jsonDist.endPoint = this._endPoint.toJSON();
    jsonDist.showAxes = this._showAxes;
    jsonDist.formatting = {
      length: {
        koqName: this._lengthKoQ,
        persistenceUnitName: this._lengthPersistenceUnitName,
      },
      bearing: {
        koqName: this._bearingKoQ,
        persistenceUnitName: this._bearingPersistenceUnitName,
      },
      coordinate: {
        koqName: this._coordinateKoQ,
        persistenceUnitName: this._coordinatePersistenceUnitName,
      },
    };
  }

  public static create(start: Point3d, end: Point3d, viewType?: string, formatting?: DistanceMeasurementFormattingProps): DistanceMeasurement {
    // Don't ned to serialize the points, will just work as is
    const measurement = new DistanceMeasurement({
      startPoint: start,
      endPoint: end,
      formatting
    });
    if (viewType) measurement.viewTarget.include(viewType);

    return measurement;
  }

  public static fromJSON(data: DistanceMeasurementProps): DistanceMeasurement {
    return new DistanceMeasurement(data);
  }
}

// Ensure all distance measurements respond to when show axes is turned on/off in preferences
function onDisplayMeasurementAxesHandler(
  propChanged: MeasurementPreferencesProperty
) {
  if (propChanged !== MeasurementPreferencesProperty.displayMeasurementAxes)
    return;

  const showAxes = MeasurementPreferences.current.displayMeasurementAxes;

  MeasurementManager.instance.forAllMeasurements((measurement: Measurement) => {
    if (measurement instanceof DistanceMeasurement)
      measurement.showAxes = showAxes;

    return true;
  });
}

MeasurementPreferences.current.onPreferenceChanged.addListener(
  onDisplayMeasurementAxesHandler
);
