/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import type { Ray3d, Transform } from "@itwin/core-geometry";
import { IModelApp, QuantityType } from "@itwin/core-frontend";
import { Point3d, PolygonOps } from "@itwin/core-geometry";
import { FormatterUtils } from "./FormatterUtils.js";
import { StyleSet, WellKnownGraphicStyleType, WellKnownTextStyleType } from "./GraphicStyle.js";
import { TextMarker } from "./TextMarker.js";

import type { DecorateContext, GraphicBuilder} from "@itwin/core-frontend";
import type { TextEntry} from "./TextMarker.js";
import type { MeasurementFormattingProps } from "./MeasurementProps.js";
export class Polygon {
  public isSelected: boolean;
  public drawMarker: boolean;
  public drawFillArea: boolean;

  private _worldScale: number | undefined;
  private _sheetToWorldTransform?: Transform;

  private _points: Point3d[];
  private _perimeter: number;
  private _area: number;
  private _areaXY: number;
  private _overrideText?: string[] | TextEntry[];
  private _textMarker: TextMarker;
  private _styleSet: StyleSet;
  private _areaKoQ: string;
  private _areaPersistenceUnitName: string;

  public get points(): Point3d[] {
    return this._points;
  }

  public get perimeter(): number {
    return this._perimeter;
  }

  public get area(): number {
    return this._area;
  }

  public get areaXY(): number {
    return this._areaXY;
  }

  public get overrideText(): string[] | TextEntry[] | undefined {
    return this._overrideText;
  }

  public set overrideText(text: string[] | TextEntry[] | undefined) {
    this._overrideText = text;
    this.setTextToMarker();
  }

  public get center(): Point3d {
    return this._textMarker.worldLocation;
  }

  public get textMarker(): TextMarker {
    return this._textMarker;
  }

  public get styleSet(): StyleSet {
    return this._styleSet;
  }

  public set styleSet(value: StyleSet) {
    this._styleSet = value;
    this._textMarker.applyStyle(this._styleSet.getTextStyle(WellKnownTextStyleType.AreaMeasurement));
  }

  /** @deprecated Not used in Polygon.ts anymore, will eventually be removed */
  public set worldScale(scale: number | undefined) {
    this._worldScale = scale;
  }

  /** @deprecated Not used in Polygon.ts anymore, will eventually be removed */
  public get worldScale(): number {
    return this._worldScale ?? 1.0;
  }

  public set sheetToWorldTransform(transform: Transform) {
    this._sheetToWorldTransform = transform;
  }

  public get sheetToWorldTransform(): Transform | undefined{
    return this._sheetToWorldTransform;
  }

  public get areaKoQ(): string {
    return this._areaKoQ;
  }

  public set areaKoQ(value: string) {
    this._areaKoQ = value;
    this.recomputeFromPoints();
  }

  public get areaPersistenceUnitName(): string {
    return this._areaPersistenceUnitName;
  }

  public set areaPersistenceUnitName(value: string) {
    this._areaPersistenceUnitName = value;
    this.recomputeFromPoints();
  }

  constructor(points: Point3d[], copyPoints: boolean = true, styleSet?: StyleSet, worldScale?: number, formatting?: MeasurementFormattingProps) {
    this._areaKoQ = formatting?.koqName ?? "AecUnits.AREA";
    this._areaPersistenceUnitName = formatting?.persistenceUnitName ?? "Units.SQ_M";
    this._styleSet = (styleSet !== undefined) ? styleSet : StyleSet.default;
    this.drawMarker = true;
    this.drawFillArea = true;
    this._worldScale = worldScale;
    this._points = (copyPoints) ? this.copyPoints(points) : points;
    this._perimeter = this.calculatePerimeter(this.points);
    this._area = Math.abs(PolygonOps.area(this.points));
    this._areaXY = Math.abs(PolygonOps.areaXY(this.points));
    const center = this.getCenter(this.points);
    this._textMarker = TextMarker.createStyled([], center, this._styleSet.getTextStyle(WellKnownTextStyleType.AreaMeasurement)!);
    this._textMarker.pickable = false;
    this._textMarker.setMouseEnterHandler(() => { this.isSelected = true; });
    this._textMarker.setMouseLeaveHandler(() => { this.isSelected = false; });
    this.isSelected = false;
    this.recomputeFromPoints();
  }

  public recomputeFromPoints() {
    const worldPoints: Point3d[] = [];
    this.points.forEach((point) => {
      if (this.sheetToWorldTransform)
        worldPoints.push(this.sheetToWorldTransform?.multiplyPoint3d(point.clone()));
      else
        worldPoints.push(point.clone());
    });
    this._perimeter = this.calculatePerimeter(worldPoints);
    this._area = Math.abs(PolygonOps.area(worldPoints));
    this._areaXY = Math.abs(PolygonOps.areaXY(worldPoints));
    const center = this.getCenter(this.points);

    this._textMarker.worldLocation = center;
    this.setTextToMarker();
  }

  public setPoints(points: Point3d[], copyPts: boolean = true, recompute: boolean = true) {
    if (copyPts) {
      this._points = [];
      for (const pt of points)
        this._points.push(pt.clone());
    } else {
      this._points = points;
    }

    if (recompute)
      this.recomputeFromPoints();
  }

  private async setTextToMarker() {
    if (this._overrideText) {
      this._textMarker.textLines = this._overrideText;
    } else {
      const lines: string[] = [];
      const areaFormatter = FormatterUtils.getFormatterSpecWithFallback(this._areaKoQ, QuantityType.Area);
      if (undefined !== areaFormatter)
        lines.push(IModelApp.quantityFormatter.formatQuantity(this.area, areaFormatter));

      this._textMarker.textLines = lines;
    }
  }

  private copyPoints(points: Point3d[]): Point3d[] {
    const pts = new Array<Point3d>();
    for (const pt of points)
      pts.push(pt.clone());

    return pts;
  }

  public drawTextMarker(context: DecorateContext): void {
    if (this.drawMarker)
      this._textMarker.addDecoration(context);
  }

  public addToGraphicBuilder(gBuilder: GraphicBuilder, styleOverride?: string): void {

    const style = this._styleSet.getGraphicStyle(styleOverride || WellKnownGraphicStyleType.AreaMeasurement)!;
    // add points
    style.addStyledPointString(gBuilder, this.points, false);
    style.addStyledLineString(gBuilder, this.points, true);

    // add area
    if (this.drawFillArea) {
      gBuilder.setBlankingFill(style.fillColorDef);
      gBuilder.addShape(this.points);
    }
  }

  public makeSelectable(isSelectable: boolean): void {
    this._textMarker.pickable = isSelectable;
  }

  private getCenter(points: Point3d[]): Point3d {
    if (points.length === 0)
      return Point3d.createZero();

    const ray3d: Ray3d | undefined = PolygonOps.centroidAreaNormal(points);
    return (ray3d) ? ray3d.origin : points[0];
  }

  private calculatePerimeter(points: Point3d[]): number {
    let sum = 0.0;
    for (let i = 1; i < points.length; ++i)
      sum += points[i - 1].distance(points[i]);
    return sum;
  }
}
