/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import type { Id64String } from "@itwin/core-bentley";
import type { XYZProps } from "@itwin/core-geometry";
import {
  Arc3d,
  IModelJson,
  Point3d,
  Ray3d,
  Vector3d,
} from "@itwin/core-geometry";
import type { GeometryStreamProps } from "@itwin/core-common";
import type {
  BeButtonEvent,
  DecorateContext,
  Viewport,
} from "@itwin/core-frontend";
import { GraphicType, IModelApp } from "@itwin/core-frontend";
import {
  StyleSet,
  WellKnownGraphicStyleType,
  WellKnownTextStyleType,
} from "../api/GraphicStyle.js";
import type {
  MeasurementEqualityOptions,
  MeasurementWidgetData,
} from "../api/Measurement.js";
import {
  Measurement,
  MeasurementPickContext,
  MeasurementSerializer,
} from "../api/Measurement.js";
import { MeasurementPropertyHelper } from "../api/MeasurementPropertyHelper.js";
import type { MeasurementFormattingProps, MeasurementProps } from "../api/MeasurementProps.js";
import { MeasurementSelectionSet } from "../api/MeasurementSelectionSet.js";
import { TextMarker } from "../api/TextMarker.js";
import { ViewHelper } from "../api/ViewHelper.js";
import { MeasureTools } from "../MeasureTools.js";

export interface RadiusMeasurementProps extends MeasurementProps {
  startPoint?: XYZProps;
  midPoint?: XYZProps;
  endPoint?: XYZProps;
  formatting?: RadiusMeasurementFormattingProps;
}

/** Formatting properties for Radius measurement. */
export interface RadiusMeasurementFormattingProps {
  /** Defaults to "AecUnits.LENGTH" and "Units.M" */
  length?: MeasurementFormattingProps;
}

export class RadiusMeasurementSerializer extends MeasurementSerializer {
  public static readonly radiusMeasurementName = "radiusMeasurement";

  public get measurementName(): string {
    return RadiusMeasurementSerializer.radiusMeasurementName;
  }

  public isValidType(measurement: Measurement): boolean {
    return measurement instanceof RadiusMeasurement;
  }

  protected parseSingle(data: MeasurementProps): Measurement | undefined {
    if (!this.isValidJSON(data)) return undefined;

    const props = data as RadiusMeasurementProps;
    return RadiusMeasurement.fromJSON(props);
  }
}

export class RadiusMeasurement extends Measurement {
  public static override readonly serializer = Measurement.registerSerializer(
    new RadiusMeasurementSerializer()
  );

  private _arc: Arc3d | undefined;
  private _startPoint: Point3d | undefined;
  private _midPoint: Point3d | undefined;
  private _endPoint: Point3d | undefined;
  private _lengthKoQ: string;
  private _lengthPersistenceUnitName: string;

  private _textMarker?: TextMarker;
  private _isDynamic: boolean;

  public get isDynamic(): boolean {
    return this._isDynamic;
  }
  public set isDynamic(v: boolean) {
    this._isDynamic = v;
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

  constructor(props?: RadiusMeasurementProps) {
    super();

    this._isDynamic = false;
    this._lengthKoQ = "AecUnits.LENGTH";
    this._lengthPersistenceUnitName = "Units.M";
    if (props) this.readFromJSON(props);

    this.populateFormattingSpecsRegistry().then(() => this.createTextMarker().catch())
    .catch();
  }

  public get startPointRef(): Point3d | undefined {
    return this._startPoint;
  }
  public get midPointRef(): Point3d | undefined {
    return this._midPoint;
  }
  public get endPointRef(): Point3d | undefined {
    return this._endPoint;
  }

  public get arcRef(): Arc3d | undefined {
    return this._arc;
  }
  public get radius(): number | undefined {
    if (this._arc) return this._arc.circularRadius();

    return undefined;
  }

  /** Create an arc from midpoint, start and end */
  private _createArcFrom(midpoint: Point3d, start: Point3d, end: Point3d) {
    return Arc3d.createCircularStartMiddleEnd(start, midpoint, end);
  }

  private _updateArc() {
    if (
      this._startPoint !== undefined &&
      this._midPoint !== undefined &&
      this._endPoint !== undefined
    ) {
      const arc = this._createArcFrom(
        this._midPoint,
        this._startPoint,
        this._endPoint
      );

      if (arc !== undefined && arc instanceof Arc3d) {
        this._arc = arc;
        this.createTextMarker().catch(); // eslint-disable-line @typescript-eslint/no-floating-promises
      }
    }
  }

  public override readFromJSON(props: RadiusMeasurementProps) {
    super.readFromJSON(props);
    if (props.startPoint) this._startPoint = Point3d.fromJSON(props.startPoint);
    if (props.midPoint) this._midPoint = Point3d.fromJSON(props.midPoint);
    if (props.endPoint) this._endPoint = Point3d.fromJSON(props.endPoint);
    if (props.formatting?.length?.koqName) this._lengthKoQ = props.formatting.length.koqName;
    if (props.formatting?.length?.persistenceUnitName) this._lengthPersistenceUnitName = props.formatting.length.persistenceUnitName;
    this._updateArc();
  }

  /**
   * Serializes properties to a JSON object.
   * @param json JSON object to append data to.
   */
  protected override writeToJSON(json: MeasurementProps) {
    super.writeToJSON(json);

    const jsonDist = json as RadiusMeasurementProps;
    if (this._startPoint) jsonDist.startPoint = this._startPoint.toJSON();
    if (this._endPoint) jsonDist.endPoint = this._endPoint.toJSON();
    if (this._midPoint) jsonDist.midPoint = this._midPoint.toJSON();
    jsonDist.formatting = {
      length: {
        koqName: this._lengthKoQ,
        persistenceUnitName: this._lengthPersistenceUnitName,
      },
    };
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
    const otherDist = other as RadiusMeasurement;
    if (
      otherDist === undefined ||
      !equalsPointOrUndef(this._startPoint, otherDist._startPoint, tol) ||
      !equalsPointOrUndef(this._midPoint, otherDist._midPoint, tol) ||
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

    if (other instanceof RadiusMeasurement) {
      this._isDynamic = other._isDynamic;
      this._startPoint = other._startPoint
        ? other._startPoint.clone()
        : undefined;
      this._midPoint = other._midPoint ? other._midPoint.clone() : undefined;
      this._endPoint = other._endPoint ? other._endPoint.clone() : undefined;
      this._updateArc();
    }
  }

  public setStartPoint(point: Point3d) {
    this._startPoint = point;
    this._updateArc();
  }

  public setMidPoint(point: Point3d) {
    this._midPoint = point;
    this._updateArc();
  }

  public setEndPoint(point: Point3d) {
    this._endPoint = point;
    this._updateArc();
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
      "MeasureTools:tools.MeasureRadius.measurement"
    );
  }

  public override getDecorationGeometry(
    _pickContext: MeasurementPickContext
  ): GeometryStreamProps | undefined {
    if (this.isDynamic) return undefined;

    if (this._arc !== undefined) {
      const geometry = [IModelJson.Writer.toIModelJson(this._arc)];
      return geometry;
    }

    return undefined;
  }

  public override async populateFormattingSpecsRegistry(): Promise<void> {
    const lengthEntry = IModelApp.quantityFormatter.getSpecsByName(this._lengthKoQ);
    if (!lengthEntry || lengthEntry.formatterSpec.persistenceUnit?.name !== this._lengthPersistenceUnitName) {
      const lengthFormatProps = await IModelApp.formatsProvider.getFormat(this._lengthKoQ);
      if (lengthFormatProps) {
        await IModelApp.quantityFormatter.addFormattingSpecsToRegistry(this._lengthKoQ, this._lengthPersistenceUnitName, lengthFormatProps);
      }
    }
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

  private _createInViewArc(
    viewport: Viewport,
    offset: number
  ): Arc3d | undefined {
    if (this._arc !== undefined) {
      const viewPoints = [
        this._arc.center.clone(),
        this._arc.startPoint(),
        this._arc.endPoint(),
      ];
      viewport.worldToViewArray(viewPoints);

      const rect = viewport.viewRect;
      if (rect.containsPoint(viewPoints[0])) {
        return undefined;
      } else if (
        rect.containsPoint(viewPoints[1]) &&
        rect.containsPoint(viewPoints[2])
      ) {
        // If center is not shown but the arc points are shown, draw another arc
        const startViewPoint = ViewHelper.closestIntersectionWithViewPlanes(
          rect,
          Ray3d.createStartEnd(viewPoints[1], viewPoints[0])
        );
        const endViewPoint = ViewHelper.closestIntersectionWithViewPlanes(
          rect,
          Ray3d.createStartEnd(viewPoints[2], viewPoints[0])
        );
        if (endViewPoint !== undefined && startViewPoint !== undefined) {
          const start = viewport.viewToWorld(startViewPoint);
          const end = viewport.viewToWorld(endViewPoint);
          const radiusStart = this._arc.center.distance(start);
          const radiusEnd = this._arc.center.distance(end);
          const radius = Math.max(radiusStart, radiusEnd);
          const startToCenter = Vector3d.createStartEnd(
            this._arc.center,
            this._arc.startPoint()
          );
          const endToCenter = Vector3d.createStartEnd(
            this._arc.center,
            this._arc.endPoint()
          );
          const newStart = this._arc.center.clone();
          // Add a offset scaling of radius to show points inside viewport and not on end
          newStart.addInPlace(
            startToCenter.scaleToLength(radius * (1 + offset))!
          );
          const newEnd = this._arc.center.clone();
          newEnd.addInPlace(endToCenter.scaleToLength(radius * (1 + offset))!);

          const arc = this._arc.clone();
          const actualRadius = this._arc.circularRadius()!;
          arc.scaleAboutCenterInPlace((radius * (1 + offset)) / actualRadius);
          return arc;
        }
      }
    }
    return undefined;
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

    if (this._startPoint !== undefined && this._arc === undefined) {
      style.addStyledPointString(builder, [this._startPoint], true);
    }

    if (this._midPoint !== undefined && this._arc === undefined) {
      style.addStyledPointString(builder, [this._midPoint], true);
    }

    if (this._arc) {
      const viewPoints = [
        this._arc.center.clone(),
        this._arc.startPoint(),
        this._arc.endPoint(),
      ];
      context.viewport.worldToViewArray(viewPoints);

      const rect = context.viewport.viewRect;
      // If center is shown in viewport, draw linestrings to it
      if (rect.containsPoint(viewPoints[0])) {
        style.addStyledArc(builder, this._arc, true);
        const linestring1 = [this._arc.center, this._arc.startPoint()];
        const linestring2 = [this._arc.center, this._arc.endPoint()];

        style.addStyledLineString(builder, linestring1, true);
        style.addStyledLineString(builder, linestring2, true);
      } else if (
        rect.containsPoint(viewPoints[1]) &&
        rect.containsPoint(viewPoints[2])
      ) {
        style.addStyledArc(builder, this._arc, true);
        const inViewArc = this._createInViewArc(context.viewport, 0.05);
        if (inViewArc !== undefined) {
          const linestring1 = [this._arc.startPoint(), inViewArc.startPoint()!];
          const linestring2 = [this._arc.endPoint(), inViewArc.endPoint()!];

          style.addStyledLineString(builder, linestring1, true);
          style.addStyledLineString(builder, linestring2, true);
          style.addStyledArc(builder, inViewArc, true);
        }
      }
      if (this._textMarker && this.displayLabels) {
        this._textMarker.worldLocation = this.calculateTextLocation(context);
        this._textMarker.addDecoration(context);
      }
    }

    context.addDecorationFromBuilder(builder);
  }

  protected override async getDataForMeasurementWidgetInternal(): Promise<MeasurementWidgetData> {
    const lengthSpec = IModelApp.quantityFormatter.getSpecsByName(this._lengthKoQ)?.formatterSpec;

    const radius = this._arc?.circularRadius() ?? 0.0;
    const diameter = radius * 2;
    const length = this._arc?.curveLength() ?? 0.0;
    const circumference = 2 * Math.PI * radius;

    const fRadius = IModelApp.quantityFormatter.formatQuantity(
      radius,
      lengthSpec
    );
    const fDiameter = IModelApp.quantityFormatter.formatQuantity(
      diameter,
      lengthSpec
    );
    const fCircumference = IModelApp.quantityFormatter.formatQuantity(
      circumference,
      lengthSpec
    );
    const fArcLength = IModelApp.quantityFormatter.formatQuantity(
      length,
      lengthSpec
    );

    let title = MeasureTools.localization.getLocalizedString(
      "MeasureTools:tools.MeasureRadius.measurement"
    );
    title += ` [${fRadius}]`;

    const data: MeasurementWidgetData = { title, properties: [] };
    MeasurementPropertyHelper.tryAddNameProperty(this, data.properties);

    data.properties.push({
      label: MeasureTools.localization.getLocalizedString(
        "MeasureTools:tools.MeasureRadius.radius"
      ),
      name: "RadiusMeasurement_Radius",
      value: fRadius,
      aggregatableValue:
        lengthSpec !== undefined
          ? { value: radius, formatSpec: lengthSpec }
          : undefined,
    });
    data.properties.push({
      label: MeasureTools.localization.getLocalizedString(
        "MeasureTools:tools.MeasureRadius.diameter"
      ),
      name: "RadiusMeasurement_Diameter",
      value: fDiameter,
      aggregatableValue:
        lengthSpec !== undefined
          ? { value: diameter, formatSpec: lengthSpec }
          : undefined,
    });
    data.properties.push({
      label: MeasureTools.localization.getLocalizedString(
        "MeasureTools:tools.MeasureRadius.arcLength"
      ),
      name: "RadiusMeasurement_ArcLength",
      value: fArcLength,
      aggregatableValue:
        lengthSpec !== undefined
          ? { value: length, formatSpec: lengthSpec }
          : undefined,
    });
    data.properties.push({
      label: MeasureTools.localization.getLocalizedString(
        "MeasureTools:tools.MeasureRadius.circleCircumference"
      ),
      name: "RadiusMeasurement_CircleCircumference",
      value: fCircumference,
      aggregatableValue:
        lengthSpec !== undefined
          ? { value: circumference, formatSpec: lengthSpec }
          : undefined,
    });

    return data;
  }

  /** Make sure the text is still on screen even if parts of the  graphics are outside.
   * Returned point is in WORLD coordinates.
   */
  private calculateTextLocation(context: DecorateContext): Point3d {
    if (this._arc) {
      const inViewArc = this._createInViewArc(context.viewport, 0.15);
      if (inViewArc === undefined) return this._arc.center;

      return Point3d.createAdd2Scaled(
        inViewArc.startPoint(),
        0.5,
        inViewArc.endPoint(),
        0.5
      );
    }

    throw Error("No arc defined for measurement");
  }

  private async createTextMarker(): Promise<void> {
    if (this._arc !== undefined) {
      const lengthSpec = IModelApp.quantityFormatter.getSpecsByName(this._lengthKoQ)?.formatterSpec;
      const radius = this._arc.circularRadius()!;
      const fRadius = IModelApp.quantityFormatter.formatQuantity(
        radius,
        lengthSpec
      );
      const point = this._arc.center;
      const styleTheme = StyleSet.getOrDefault(this.activeStyle);

      const tStyle = styleTheme.getTextStyle(
        WellKnownTextStyleType.DistanceMeasurement
      )!;
      this._textMarker = TextMarker.createStyled(
        [`R: ${fRadius}`],
        point,
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

  public override onDisplayUnitsChanged(): void {
    this.createTextMarker().catch(); // eslint-disable-line @typescript-eslint/no-floating-promises
  }

  private _handleTextMarkerButtonEvent(ev: BeButtonEvent): boolean {
    if (!this.isDynamic)
      // eslint-disable-next-line @typescript-eslint/no-floating-promises
      this.onDecorationButtonEvent(
        MeasurementPickContext.createFromSourceId("Invalid", ev)
      ).catch();
    return true;
  }

  public static fromJSON(data: RadiusMeasurementProps): RadiusMeasurement {
    return new RadiusMeasurement(data);
  }

  public static create(
    startPoint: Point3d,
    midPoint?: Point3d,
    endPoint?: Point3d,
    viewType?: string,
    formatting?: RadiusMeasurementFormattingProps
  ) {
    const measurement = new RadiusMeasurement({
      startPoint,
      midPoint,
      endPoint,
      formatting
    });

    if (viewType) measurement.viewTarget.include(viewType);

    return measurement;
  }
}
