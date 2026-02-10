/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import type { Id64String } from "@itwin/core-bentley";
import type { XYZProps } from "@itwin/core-geometry";
import { GraphicType, IModelApp, QuantityType } from "@itwin/core-frontend";
import { Angle, AngleSweep, Arc3d, AxisOrder, IModelJson, Matrix3d, Point3d, PointString3d, Vector3d } from "@itwin/core-geometry";
import { FormatterUtils } from "../api/FormatterUtils.js";
import { StyleSet, WellKnownGraphicStyleType, WellKnownTextStyleType } from "../api/GraphicStyle.js";
import { Measurement, MeasurementPickContext, MeasurementSerializer } from "../api/Measurement.js";
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
export interface AngleMeasurementProps extends MeasurementProps {
  startPoint?: XYZProps;
  center?: XYZProps;
  endPoint?: XYZProps;
  formatting?: AngleMeasurementFormattingProps;
}

/** Formatting properties for angle measurement. */
export interface AngleMeasurementFormattingProps {
  /** Defaults to "DefaultToolsUnits.ANGLE" and "Units.RAD" */
  angle?: MeasurementFormattingProps;
}

export class AngleMeasurementSerializer extends MeasurementSerializer {
  public static readonly angleMeasurementName = "angleMeasurement";

  public get measurementName(): string {
    return AngleMeasurementSerializer.angleMeasurementName;
  }

  public isValidType(measurement: Measurement): boolean {
    return measurement instanceof AngleMeasurement;
  }

  protected parseSingle(data: MeasurementProps): Measurement | undefined {
    if (!this.isValidJSON(data)) return undefined;

    const props = data as AngleMeasurementProps;
    return AngleMeasurement.fromJSON(props);
  }
}

export class AngleMeasurement extends Measurement {
  public static override readonly serializer = Measurement.registerSerializer(
    new AngleMeasurementSerializer()
  );

  private _startPoint: Point3d | undefined;
  private _center: Point3d | undefined;
  private _endPoint: Point3d | undefined;
  private _angleKoQ: string;
  private _anglePersistenceUnitName: string;

  private _textMarker?: TextMarker;
  private _isDynamic: boolean;

  public get isDynamic(): boolean {
    return this._isDynamic;
  }
  public set isDynamic(v: boolean) {
    this._isDynamic = v;
  }

  constructor(props?: AngleMeasurementProps) {
    super();

    this._isDynamic = false;
    this._angleKoQ = "DefaultToolsUnits.ANGLE";
    this._anglePersistenceUnitName = "Units.RAD";
    if (props) this.readFromJSON(props);

    this.createTextMarker().catch();
  }

  public get startPointRef(): Point3d | undefined {
    return this._startPoint;
  }
  public get centerRef(): Point3d | undefined {
    return this._center;
  }
  public get endPointRef(): Point3d | undefined {
    return this._endPoint;
  }

  public get angle(): number | undefined {
    if (
      this._startPoint === undefined ||
      this._center === undefined ||
      this._endPoint === undefined
    )
      return undefined;

    const v1 = Vector3d.createStartEnd(this._center, this._startPoint);
    const v2 = Vector3d.createStartEnd(this._center, this._endPoint);
    const dot = v1.dotProduct(v2);
    const mags = v1.magnitude() * v2.magnitude();
    const angle = mags !== 0 ? Math.acos(dot / mags) : 0;
    return angle;
  }

  public get angleKoQ(): string {
    return this._angleKoQ;
  }
  public set angleKoQ(koqName: string) {
    this._angleKoQ = koqName;
    this.createTextMarker().catch(); // eslint-disable-line @typescript-eslint/no-floating-promises
  }
  public get anglePersistenceUnitName(): string {
    return this._anglePersistenceUnitName;
  }
  public set anglePersistenceUnitName(unitName: string) {
    this._anglePersistenceUnitName = unitName;
    this.createTextMarker().catch(); // eslint-disable-line @typescript-eslint/no-floating-promises
  }

  public override readFromJSON(props: AngleMeasurementProps) {
    super.readFromJSON(props);
    if (props.startPoint) this._startPoint = Point3d.fromJSON(props.startPoint);
    if (props.center) this._center = Point3d.fromJSON(props.center);
    if (props.endPoint) this._endPoint = Point3d.fromJSON(props.endPoint);
    if (props.formatting?.angle?.koqName) this._angleKoQ = props.formatting.angle.koqName;
    if (props.formatting?.angle?.persistenceUnitName) this._anglePersistenceUnitName = props.formatting.angle.persistenceUnitName;

    this.createTextMarker().catch(); // eslint-disable-line @typescript-eslint/no-floating-promises
  }

  /**
   * Serializes properties to a JSON object.
   * @param json JSON object to append data to.
   */
  protected override writeToJSON(json: MeasurementProps) {
    super.writeToJSON(json);

    const jsonDist = json as AngleMeasurementProps;
    if (this._startPoint) jsonDist.startPoint = this._startPoint.toJSON();
    if (this._endPoint) jsonDist.endPoint = this._endPoint.toJSON();
    if (this._center) jsonDist.center = this._center.toJSON();
    jsonDist.formatting = {
      angle: {
        koqName: this._angleKoQ,
        persistenceUnitName: this._anglePersistenceUnitName,
      }
    };
  }

  public override onDisplayUnitsChanged(): void {
    this.createTextMarker().catch(); // eslint-disable-line @typescript-eslint/no-floating-promises
  }

  public override async populateFormattingSpecsRegistry(_force?: boolean): Promise<void> {
    const angleEntry = IModelApp.quantityFormatter.getSpecsByName(this._angleKoQ);
    if (_force || !angleEntry || angleEntry.formatterSpec.persistenceUnit?.name !== this._anglePersistenceUnitName) {
      const angleFormatProps = await IModelApp.formatsProvider.getFormat(this._angleKoQ);
      if (angleFormatProps) {
        await IModelApp.quantityFormatter.addFormattingSpecsToRegistry(
          this._angleKoQ,
          this._anglePersistenceUnitName,
          angleFormatProps
        );
      }
    }
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

    const equalsPointOrUndef = (
      a: Point3d | undefined,
      b: Point3d | undefined,
      tolerance?: number
    ): boolean => {
      if (a === undefined && b === undefined) return true;
      if (a === undefined && b !== undefined) return false;
      if (a !== undefined && b === undefined) return false;
      if (a !== undefined && b !== undefined)
        return a?.isAlmostEqual(b, tolerance);
      return false;
    };

    // Compare data (ignore isDynamic)
    const tol = opts ? opts.tolerance : undefined;
    const otherDist = other as AngleMeasurement;
    if (
      otherDist === undefined ||
      !equalsPointOrUndef(this._startPoint, otherDist._startPoint, tol) ||
      !equalsPointOrUndef(this._center, otherDist._center, tol) ||
      !equalsPointOrUndef(this._endPoint, otherDist._endPoint, tol)
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

    if (other instanceof AngleMeasurement) {
      this._isDynamic = other._isDynamic;
      this._startPoint = other._startPoint
        ? other._startPoint.clone()
        : undefined;
      this._center = other._center ? other._center.clone() : undefined;
      this._endPoint = other._endPoint ? other._endPoint.clone() : undefined;
      this.createTextMarker().catch(); // eslint-disable-line @typescript-eslint/no-floating-promises
    }
  }

  public setStartPoint(point: Point3d) {
    this._startPoint = point;
    this.createTextMarker().catch(); // eslint-disable-line @typescript-eslint/no-floating-promises
  }

  public setCenter(point: Point3d) {
    this._center = point;
    this.createTextMarker().catch(); // eslint-disable-line @typescript-eslint/no-floating-promises
  }

  public setEndPoint(point: Point3d) {
    this._endPoint = point;
    this.createTextMarker().catch(); // eslint-disable-line @typescript-eslint/no-floating-promises
  }

  public override testDecorationHit(pickContext: MeasurementPickContext) {
    if (this.transientId && this.transientId === pickContext.geomId)
      return true;

    if (
      pickContext.buttonEvent &&
      this._textMarker &&
      this.displayLabels &&
      this._textMarker.pick(pickContext.buttonEvent.viewPoint)
    )
      return true;

    return false;
  }

  public override async getDecorationToolTip(
    _pickContext: MeasurementPickContext
  ): Promise<HTMLElement | string> {
    return MeasureTools.localization.getLocalizedString(
      "MeasureTools:tools.MeasureAngle.measurement"
    );
  }

  public override getDecorationGeometry(
    _pickContext: MeasurementPickContext
  ): GeometryStreamProps | undefined {
    // No need to snap to the geometry during dynamics
    if (this._isDynamic) return undefined;

    const geometry = [
      IModelJson.Writer.toIModelJson(
        PointString3d.create(this._startPoint, this._center, this._endPoint)
      ),
    ];
    return geometry;
  }

  private _getSnapId(): string | undefined {
    if (!this.transientId)
      this.transientId = MeasurementSelectionSet.nextTransientId;

    if (this.isDynamic) return undefined;

    return this.transientId;
  }

  protected override onTransientIdChanged(_prevId: Id64String) {
    if (this._textMarker) this._textMarker.transientHiliteId = this.transientId;
  }

  private _createDecorationArc(
    p0: Point3d,
    center: Point3d,
    p1: Point3d
  ): Arc3d | undefined {
    if (
      center.isAlmostEqual(p0) ||
      center.isAlmostEqual(p1) ||
      p0.isAlmostEqual(p1)
    )
      return undefined;

    const v1 = Vector3d.createStartEnd(center, p0);
    v1.normalizeInPlace();
    const v2 = Vector3d.createStartEnd(center, p1);
    v2.normalizeInPlace();
    const length = Math.min(v1.magnitude(), v2.magnitude()) / 2.0;
    const matrix = Matrix3d.createRigidFromColumns(v1, v2, AxisOrder.XYZ);
    const angle = this.angle;
    if (matrix === undefined || angle === undefined) return undefined;

    const startAngle = Angle.createRadians(0);
    const sweepAngle = Angle.createRadians(angle);
    return Arc3d.createScaledXYColumns(
      center,
      matrix,
      length,
      length,
      AngleSweep.createStartSweep(startAngle, sweepAngle)
    );
  }

  public override decorate(context: DecorateContext): void {
    super.decorate(context);

    const styleTheme = StyleSet.getOrDefault(this.activeStyle);
    const style = styleTheme.getGraphicStyle(
      WellKnownGraphicStyleType.DistanceMeasurement
    )!;
    const builder = context.createGraphicBuilder(
      GraphicType.WorldOverlay,
      undefined,
      this._getSnapId()
    );

    if (
      this._startPoint !== undefined &&
      this._center === undefined &&
      this._endPoint === undefined
    ) {
      style.addStyledPointString(builder, [this._startPoint], true);
    } else if (
      this._startPoint !== undefined &&
      this._center !== undefined &&
      this._endPoint === undefined
    ) {
      style.addStyledLineString(
        builder,
        [this._startPoint, this._center],
        true
      );
    } else if (
      this._startPoint !== undefined &&
      this._center !== undefined &&
      this._endPoint !== undefined
    ) {
      style.addStyledLineString(
        builder,
        [this._startPoint, this._center],
        true
      );
      style.addStyledLineString(builder, [this._center, this._endPoint], true);

      const arc = this._createDecorationArc(
        this._startPoint,
        this._center,
        this._endPoint
      );
      if (arc !== undefined) style.addStyledArc(builder, arc, true);

      if (this._textMarker && this.displayLabels) {
        const textLocation =
          arc !== undefined ? arc.fractionToPoint(0.5) : this._center;
        this._textMarker.worldLocation = textLocation;
        this._textMarker.addDecoration(context);
      }
    }

    context.addDecorationFromBuilder(builder);
  }

  protected override async getDataForMeasurementWidgetInternal(): Promise<MeasurementWidgetData> {
    const angleSpec = FormatterUtils.getFormatterSpecWithFallback(this._angleKoQ, QuantityType.Angle);
    const angle = this.angle ?? 0;
    const fAngle = await FormatterUtils.formatAngle(angle, angleSpec);

    let title = MeasureTools.localization.getLocalizedString(
      "MeasureTools:tools.MeasureAngle.measurement"
    );
    title += ` [${fAngle}]`;

    const data: MeasurementWidgetData = { title, properties: [] };
    MeasurementPropertyHelper.tryAddNameProperty(this, data.properties);

    data.properties.push({
      label: MeasureTools.localization.getLocalizedString(
        "MeasureTools:tools.MeasureAngle.angle"
      ),
      name: "AngleMeasurement_Angle",
      value: fAngle,
      aggregatableValue:
        angleSpec !== undefined
          ? { value: angle, formatSpec: angleSpec }
          : undefined,
    });

    return data;
  }

  private async createTextMarker(): Promise<void> {
    if (this._center !== undefined && this.angle !== undefined) {
      const angleSpec = FormatterUtils.getFormatterSpecWithFallback(this._angleKoQ, QuantityType.Angle);
      const angle = this.angle;
      const fAngle = await FormatterUtils.formatAngle(
        angle,
        angleSpec
      );
      const styleTheme = StyleSet.getOrDefault(this.activeStyle);

      const tStyle = styleTheme.getTextStyle(
        WellKnownTextStyleType.DistanceMeasurement
      )!;
      this._textMarker = TextMarker.createStyled(
        [fAngle],
        this._center,
        tStyle
      );
      this._textMarker.transientHiliteId = this.transientId;
      this._textMarker.pickable = !this.isDynamic;
      this._textMarker.setMouseButtonHandler(
        this._handleTextMarkerButtonEvent.bind(this)
      );
    }
  }

  private updateMarkerStyle() {
    if (!this._textMarker) return;

    const styleTheme = StyleSet.getOrDefault(this.activeStyle);

    const tStyle = styleTheme.getTextStyle(
      WellKnownTextStyleType.DistanceMeasurement
    )!;
    this._textMarker.applyStyle(tStyle);
  }

  protected override onStyleChanged(_isLock: boolean, _prevStyle: string) {
    this.updateMarkerStyle();
  }

  protected override onLockToggled() {
    this.updateMarkerStyle();
  }

  private _handleTextMarkerButtonEvent(ev: BeButtonEvent): boolean {
    if (!this.isDynamic)
      // eslint-disable-next-line @typescript-eslint/no-floating-promises
      this.onDecorationButtonEvent(
        MeasurementPickContext.createFromSourceId("Invalid", ev)
      ).catch();
    return true;
  }

  public static fromJSON(data: AngleMeasurementProps): AngleMeasurement {
    return new AngleMeasurement(data);
  }

  public static create(
    startPoint: Point3d,
    center?: Point3d,
    endPoint?: Point3d,
    viewType?: string,
    formatting?: AngleMeasurementFormattingProps
  ) {
    const measurement = new AngleMeasurement({
      startPoint,
      center,
      endPoint,
      formatting
    });

    if (viewType) measurement.viewTarget.include(viewType);

    return measurement;
  }
}
