/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { Point3d, XYZProps, IModelJson, PointString3d, LineSegment3d, Ray3d, Range3d, XYAndZ, Vector3d } from "@bentley/geometry-core";
import { DecorateContext, GraphicType, IModelApp, QuantityType, BeButtonEvent } from "@bentley/imodeljs-frontend";
import { Id64String } from "@bentley/bentleyjs-core";
import { GeometryStreamProps } from "@bentley/imodeljs-common";
import { Measurement, MeasurementSerializer, MeasurementPickContext, MeasurementWidgetData, MeasurementEqualityOptions } from "../api/Measurement";
import { MeasurementProps } from "../api/MeasurementProps";
import { StyleSet, TextOffsetType, WellKnownGraphicStyleType, WellKnownTextStyleType } from "../api/GraphicStyle";
import { TextMarker } from "../api/TextMarker";
import { FormatterUtils } from "../api/FormatterUtils";
import { MeasurementSelectionSet } from "../api/MeasurementSelectionSet";
import { MeasurementPreferences, MeasurementPreferencesProperty } from "../api/MeasurementPreferences";
import { ViewHelper } from "../api/ViewHelper";
import { MeasurementManager } from "../api/MeasurementManager";

/**
 * Props for serializing a [[DistanceMeasurement]].
 */
export interface DistanceMeasurementProps extends MeasurementProps {
  startPoint: XYZProps;
  endPoint: XYZProps;
  showAxes?: boolean;
}

/** Serializer for a [[DistanceMeasurement]]. */
export class DistanceMeasurementSerializer extends MeasurementSerializer {
  public static readonly distanceMeasurementName = "distanceMeasurement";

  public get measurementName(): string { return DistanceMeasurementSerializer.distanceMeasurementName; }

  public isValidType(measurement: Measurement): boolean {
    return measurement instanceof DistanceMeasurement;
  }

  public isValidJSON(json: any): boolean {
    if (!super.isValidJSON(json) || !json.hasOwnProperty("startPoint") || !json.hasOwnProperty("endPoint"))
      return false;

    return true;
  }

  protected parseSingle(data: MeasurementProps): Measurement | undefined {
    if (!this.isValidJSON(data))
      return undefined;

    const props = data as DistanceMeasurementProps;
    return DistanceMeasurement.fromJSON(props);
  }
}

/**
 * Distance measurement. Composed of a line and a formatted distance in a "text pill" in the middle of the line.
 */
export class DistanceMeasurement extends Measurement {
  public static readonly serializer = Measurement.registerSerializer(new DistanceMeasurementSerializer());

  private _startPoint: Point3d;
  private _endPoint: Point3d;
  private _showAxes: boolean;

  private _isDynamic: boolean; // No serialize
  private _textMarker?: TextMarker; // No serialize

  private _runRiseAxes: DistanceMeasurement[]; // No serialize.
  private _textStyleOverride?: WellKnownTextStyleType; // No serialize.
  private _graphicStyleOverride?: WellKnownGraphicStyleType; // No serialize.

  public get startPointRef(): Point3d { return this._startPoint; }
  public get endPointRef(): Point3d { return this._endPoint; }

  public get isDynamic(): boolean { return this._isDynamic; }
  public set isDynamic(v: boolean) {
    this._isDynamic = v;
    this._runRiseAxes.forEach((axis: DistanceMeasurement) => axis.isDynamic = v);

    if (this._textMarker)
      this._textMarker.pickable = !v;
  }

  public get showAxes(): boolean { return this._showAxes; }
  public set showAxes(v: boolean) { this._showAxes = v; }

  private get isAxis(): boolean {
    return undefined !== this._textStyleOverride || undefined !== this._graphicStyleOverride;
  }

  constructor(props?: DistanceMeasurementProps) {
    super();

    this._startPoint = Point3d.createZero();
    this._endPoint = Point3d.createZero();
    this._isDynamic = false;
    this._showAxes = MeasurementPreferences.current.displayMeasurementAxes;
    this._runRiseAxes = [];

    if (props)
      this.readFromJSON(props);

    this.createTextMarker().catch();
  }

  public setStartPoint(point: XYAndZ) {
    this._startPoint.setFrom(point);
    this.createTextMarker().catch();
    this.buildRunRiseAxes();
  }

  public setEndPoint(point: XYAndZ) {
    this._endPoint.setFrom(point);
    this.createTextMarker().catch();
    this.buildRunRiseAxes();
  }

  public setStartEndPoints(start: XYAndZ, end: XYAndZ) {
    this._startPoint.setFrom(start);
    this._endPoint.setFrom(end);
    this.createTextMarker().catch();
    this.buildRunRiseAxes();
  }

  private setupAxis(ovrGraphicStyle: WellKnownGraphicStyleType, ovrTextStyle: WellKnownTextStyleType, start: Point3d, end: Point3d) {
    this._graphicStyleOverride = ovrGraphicStyle;
    this._textStyleOverride = ovrTextStyle;
    this._startPoint.setFrom(start);
    this._endPoint.setFrom(end);
  }

  public testDecorationHit(pickContext: MeasurementPickContext): boolean {
    if (this.transientId && this.transientId === pickContext.geomId)
      return true;

    if (pickContext.buttonEvent && this._textMarker && this.displayLabels && this._textMarker.pick(pickContext.buttonEvent.viewPoint))
      return true;

    if (this._showAxes) {
      for (const axis of this._runRiseAxes) {
        if (axis.testDecorationHit(pickContext))
          return true;
      }
    }

    return false;
  }

  public getDecorationGeometry(pickContext: MeasurementPickContext): GeometryStreamProps | undefined {

    const geometry = [IModelJson.Writer.toIModelJson(PointString3d.create(this._startPoint, this._endPoint))];

    if (this._showAxes) {
      this._runRiseAxes.forEach((axis) => {
        const geom = axis.getDecorationGeometry(pickContext);
        if (geom)
          geometry.push(geom);
      });
    }

    return geometry;
  }

  public async getDecorationToolTip(_pickContext: MeasurementPickContext): Promise<HTMLElement | string> {
    return IModelApp.i18n.translate("MeasureTools:Measurements.distanceMeasurement");
  }

  private getSnapId(): string | undefined {
    if (!this.transientId)
      this.transientId = MeasurementSelectionSet.nextTransientId;

    if (this.isDynamic)
      return undefined;

    return this.transientId;
  }

  protected onTransientIdChanged(_prevId: Id64String) {
    this._runRiseAxes.forEach((axis) => axis.transientId = this.transientId);

    if (this._textMarker)
      this._textMarker.transientHiliteId = this.transientId;
  }

  public decorate(context: DecorateContext): void {
    super.decorate(context);

    const styleTheme = StyleSet.getOrDefault(this.activeStyle);
    const points = [this._startPoint, this._endPoint];

    const style = styleTheme.getGraphicStyle(this._graphicStyleOverride || WellKnownGraphicStyleType.DistanceMeasurement)!;
    const xBuilder = context.createGraphicBuilder(GraphicType.WorldOverlay, undefined, this.getSnapId());
    style.addStyledLineString(xBuilder, points, true);
    style.addStyledPointString(xBuilder, points, true);
    context.addDecorationFromBuilder(xBuilder);

    if (!this._textMarker || this._startPoint.isAlmostEqual(this._endPoint))
      return;

    const textLocation = this.calculateTextLocation(context);
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

    if (this.displayLabels)
      this._textMarker.addDecoration(context);

    if (this._showAxes)
      this._runRiseAxes.forEach((axis) => axis.decorate(context));
  }

  /** Make sure the text is still on screen even if parts of the  graphics are outside.
   * Returned point is in WORLD coordinates.
   */
  private calculateTextLocation(context: DecorateContext): Point3d {
    const viewPoints = [this._startPoint.clone(), this._endPoint.clone()];
    context.viewport.worldToViewArray(viewPoints);

    const rect = context.viewport.viewRect;
    const range = Range3d.createArray(viewPoints);
    const isNotIntersecting = (rect.width < range.low.x || range.high.x < 0.0 || rect.height < range.low.y || range.high.y < 0.0);

    let p0 = rect.containsPoint(viewPoints[0]) ? viewPoints[0] : undefined;
    let p1 = rect.containsPoint(viewPoints[1]) ? viewPoints[1] : undefined;

    if (isNotIntersecting || p0 && p1)
      return Point3d.createAdd2Scaled(this._startPoint, 0.5, this._endPoint, 0.5);

    if (!p0)
      p0 = ViewHelper.closestIntersectionWithViewPlanes(rect, Ray3d.createStartEnd(viewPoints[1], viewPoints[0])) || viewPoints[0];

    if (!p1)
      p1 = ViewHelper.closestIntersectionWithViewPlanes(rect, Ray3d.createStartEnd(viewPoints[0], viewPoints[1])) || viewPoints[1];

    const result = Point3d.createAdd2Scaled(p0, 0.5, p1, 0.5);
    return context.viewport.viewToWorld(result, result);
  }

  private buildRunRiseAxes(): void {
    this._runRiseAxes = [];

    if (this.isAxis)
      return;

    // Run point
    const runPoint = this._endPoint.clone();
    runPoint.z = this._startPoint.z;

    // It's irrelevant to draw the axes because we're in 2D already.
    if (runPoint.isAlmostEqual(this._endPoint))
      return;

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
      dm.setupAxis(graphicStyles[i], textStyles[i], line.point0Ref, line.point1Ref);
      dm.viewTarget.copyFrom(this.viewTarget);
      dm.isDynamic = this.isDynamic;
      dm.transientId = this.transientId;
      dm.displayLabels = this.displayLabels;
      this._runRiseAxes.push(dm);
    }

    // When all text markers are ready for display, trigger a refresh
    const promises = this._runRiseAxes.map((value: DistanceMeasurement) => value.createTextMarker());
    Promise.all(promises).then(() => {
      for (const axis of this._runRiseAxes) {
        if (axis._textMarker) {
          axis._textMarker.pickable = !this._isDynamic;
          axis._textMarker.transientHiliteId = this.transientId;
          axis._textMarker.setMouseButtonHandler(this.handleTextMarkerButtonEvent.bind(this));
        }
      }

      if (this._showAxes)
        IModelApp.viewManager.invalidateDecorationsAllViews();
    }).catch();
  }

  protected onStyleChanged(_isLock: boolean, _prevStyle: string) {
    this.updateMarkerStyle();
  }

  protected onLockToggled() {
    this.updateMarkerStyle();
  }

  protected onDisplayLabelsToggled() {
    for (const dm of this._runRiseAxes)
      dm.displayLabels = this.displayLabels;
  }

  public onDisplayUnitsChanged(): void {
    this.createTextMarker().catch();
    this._runRiseAxes.forEach((axis: DistanceMeasurement) => axis.onDisplayUnitsChanged());
  }

  private updateMarkerStyle() {
    if (!this._textMarker)
      return;

    const styleTheme = StyleSet.getOrDefault(this.activeStyle);

    const tStyle = styleTheme.getTextStyle(this._textStyleOverride || WellKnownTextStyleType.DistanceMeasurement)!;
    this._textMarker.applyStyle(tStyle);
  }

  private async createTextMarker(): Promise<void> {

    const lengthSpec = await IModelApp.quantityFormatter.getFormatterSpecByQuantityType(QuantityType.LengthEngineering);
    const distance = this._startPoint.distance(this._endPoint);
    const fDistance = IModelApp.quantityFormatter.formatQuantity(distance, lengthSpec);

    const midPoint = Point3d.createAdd2Scaled(this._startPoint, 0.5, this._endPoint, 0.5);
    const styleTheme = StyleSet.getOrDefault(this.activeStyle);

    const tStyle = styleTheme.getTextStyle(this._textStyleOverride || WellKnownTextStyleType.DistanceMeasurement)!;
    this._textMarker = TextMarker.createStyled([fDistance], midPoint, tStyle);
    this._textMarker.transientHiliteId = this.transientId;
    this._textMarker.pickable = !this.isDynamic;
    this._textMarker.setMouseButtonHandler(this.handleTextMarkerButtonEvent.bind(this));
  }

  private handleTextMarkerButtonEvent(ev: BeButtonEvent): boolean {
    if (!this._isDynamic)
      this.onDecorationButtonEvent(MeasurementPickContext.createFromSourceId("Invalid", ev)).catch();

    return true;
  }

  protected async getDataForMeasurementWidgetInternal(): Promise<MeasurementWidgetData> {

    const lengthSpec = await IModelApp.quantityFormatter.getFormatterSpecByQuantityType(QuantityType.LengthEngineering);

    const distance = this._startPoint.distance(this._endPoint);
    const run = this._startPoint.distanceXY(this._endPoint);
    const rise = this._endPoint.z - this._startPoint.z;
    const slope = 0.0 < run ? (100 * rise / run) : 0.0;
    const dx = Math.abs(this._endPoint.x - this._startPoint.x);
    const dy = Math.abs(this._endPoint.y - this._startPoint.y);

    const fDistance = IModelApp.quantityFormatter.formatQuantity(distance, lengthSpec);
    const fStartCoords = FormatterUtils.formatCoordinatesImmediate(this._startPoint);
    const fEndCoords = FormatterUtils.formatCoordinatesImmediate(this._endPoint);
    const fSlope = FormatterUtils.formatSlope(slope, true);
    const fRun = IModelApp.quantityFormatter.formatQuantity(run, lengthSpec);
    const fDeltaX = IModelApp.quantityFormatter.formatQuantity(dx, lengthSpec);
    const fDeltaY = IModelApp.quantityFormatter.formatQuantity(dy, lengthSpec);
    const fRise = IModelApp.quantityFormatter.formatQuantity(rise, lengthSpec);

    let title = IModelApp.i18n.translate("MeasureTools:Measurements.distanceMeasurement");
    title += " [" + fDistance + "]";

    const data: MeasurementWidgetData = { title, properties: [] };
    data.properties.push(
      { label: IModelApp.i18n.translate("MeasureTools:tools.MeasureDistance.distance"), name: "DistanceMeasurement_Distance", value: fDistance,
        aggregatableValue: (lengthSpec !== undefined ) ? { value: distance, formatSpec: lengthSpec} : undefined },
      { label: IModelApp.i18n.translate("MeasureTools:tools.MeasureDistance.run"), name: "DistanceMeasurement_Run", value: fRun,
        aggregatableValue: (lengthSpec !== undefined) ? { value: run, formatSpec: lengthSpec } : undefined },
      { label: IModelApp.i18n.translate("MeasureTools:tools.MeasureDistance.rise"), name: "DistanceMeasurement_Rise", value: fRise },
      { label: IModelApp.i18n.translate("MeasureTools:tools.MeasureDistance.slope"), name: "DistanceMeasurement_Slope", value: fSlope },
      { label: IModelApp.i18n.translate("MeasureTools:tools.MeasureDistance.delta_x"), name: "DistanceMeasurement_Dx", value: fDeltaX },
      { label: IModelApp.i18n.translate("MeasureTools:tools.MeasureDistance.delta_y"), name: "DistanceMeasurement_Dy", value: fDeltaY },
      { label: IModelApp.i18n.translate("MeasureTools:tools.MeasureDistance.startCoordinates"), name: "DistanceMeasurement_StartPoint", value: fStartCoords },
      { label: IModelApp.i18n.translate("MeasureTools:tools.MeasureDistance.endCoordinates"), name: "DistanceMeasurement_EndPoint", value: fEndCoords },
    );
    return data;
  }

  /**
   * Tests equality with another measurement.
   * @param other Measurement to test equality for.
   * @param opts Options for equality testing.
   * @returns true if the other measurement is equal, false if some property is not the same or if the measurement is not of the same type.
   */
  public equals(other: Measurement, opts?: MeasurementEqualityOptions): boolean {
    if (!super.equals(other, opts))
      return false;

    // Compare data (ignore isDynamic)
    const tol = (opts) ? opts.tolerance : undefined;
    const otherDist = other as DistanceMeasurement;
    if (otherDist === undefined || !this._startPoint.isAlmostEqual(otherDist._startPoint, tol) || !this._endPoint.isAlmostEqual(otherDist._endPoint, tol) || this._showAxes !== otherDist._showAxes)
      return false;

    return true;
  }

  /**
   * Copies data from the other measurement into this instance.
   * @param other Measurement to copy property values from.
   */
  protected copyFrom(other: Measurement) {
    super.copyFrom(other);

    if (other instanceof DistanceMeasurement) {
      this._isDynamic = other._isDynamic;
      this._showAxes = other._showAxes;
      this._startPoint.setFrom(other._startPoint);
      this._endPoint.setFrom(other._endPoint);
      this.buildRunRiseAxes();
      this.createTextMarker().catch();
    }
  }

  /**
   * Deserializes properties (if they exist) from the JSON object.
   * @param json JSON object to read data from.
   */
  protected readFromJSON(json: MeasurementProps) {
    super.readFromJSON(json);

    const jsonDist = json as DistanceMeasurementProps;
    if (jsonDist.startPoint !== undefined)
      this._startPoint.setFromJSON(jsonDist.startPoint);

    if (jsonDist.endPoint !== undefined)
      this._endPoint.setFromJSON(jsonDist.endPoint);

    this._showAxes = (jsonDist.showAxes !== undefined) ? jsonDist.showAxes : MeasurementPreferences.current.displayMeasurementAxes;

    this.buildRunRiseAxes();
    this.createTextMarker().catch();
  }

  /**
   * Serializes properties to a JSON object.
   * @param json JSON object to append data to.
   */
  protected writeToJSON(json: MeasurementProps) {
    super.writeToJSON(json);

    const jsonDist = json as DistanceMeasurementProps;
    jsonDist.startPoint = this._startPoint.toJSON();
    jsonDist.endPoint = this._endPoint.toJSON();
    jsonDist.showAxes = this._showAxes;
  }

  public static create(start: Point3d, end: Point3d, viewType?: string) {
    // Don't ned to serialize the points, will just work as is
    const measurement = new DistanceMeasurement({ startPoint: start, endPoint: end });
    if (viewType)
      measurement.viewTarget.include(viewType);

    return measurement;
  }

  public static fromJSON(data: DistanceMeasurementProps): DistanceMeasurement {
    return new DistanceMeasurement(data);
  }
}

// Ensure all distance measurements respond to when show axes is turned on/off in preferences
function distanceMeasurement_OnDisplayMeasurementAxesHandler(propChanged: MeasurementPreferencesProperty) {
  if (propChanged !== MeasurementPreferencesProperty.displayMeasurementAxes)
    return;

  const showAxes = MeasurementPreferences.current.displayMeasurementAxes;

  MeasurementManager.instance.forAllMeasurements((measurement: Measurement) => {
    if (measurement instanceof DistanceMeasurement)
      measurement.showAxes = showAxes;

    return true;
  });
}

MeasurementPreferences.current.onPreferenceChanged.addListener(distanceMeasurement_OnDisplayMeasurementAxesHandler);
