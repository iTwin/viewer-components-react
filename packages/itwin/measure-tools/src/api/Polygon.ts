/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import type { Ray3d } from "@itwin/core-geometry";
import { Point3d, PolygonOps } from "@itwin/core-geometry";
import type { DecorateContext, GraphicBuilder} from "@itwin/core-frontend";
import { IModelApp, QuantityType } from "@itwin/core-frontend";
import { StyleSet, WellKnownGraphicStyleType, WellKnownTextStyleType } from "./GraphicStyle";
import type { TextEntry} from "./TextMarker";
import { TextMarker } from "./TextMarker";

export class Polygon {
  public isSelected: boolean;
  public drawMarker: boolean;
  public drawFillArea: boolean;

  private _sheetToWorldScale: number | undefined;

  private _points: Point3d[];
  private _perimeter: number;
  private _area: number;
  private _areaXY: number;
  private _overrideText?: string[] | TextEntry[];
  private _textMarker: TextMarker;
  private _styleSet: StyleSet;

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

  public set sheetToWorldScale(scale: number | undefined) {
    this._sheetToWorldScale = scale;
  }

  public get sheetToWorldScale(): number {
    return this._sheetToWorldScale ?? 1.0;
  }

  constructor(points: Point3d[], copyPoints: boolean = true, styleSet?: StyleSet, sheetToWorldScale?: number) {
    this._styleSet = (styleSet !== undefined) ? styleSet : StyleSet.default;
    this.drawMarker = true;
    this.drawFillArea = true;
    this._sheetToWorldScale = sheetToWorldScale;
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
    this._perimeter = this.calculatePerimeter(this.points);
    this._area = Math.abs(PolygonOps.area(this.points));
    this._areaXY = Math.abs(PolygonOps.areaXY(this.points));
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

  private setTextToMarker() {
    if (this._overrideText) {
      this._textMarker.textLines = this._overrideText;
    } else {
      const lines: string[] = [];
      const areaFormatter = IModelApp.quantityFormatter.findFormatterSpecByQuantityType(QuantityType.Area);
      if (undefined !== areaFormatter)
        lines.push(IModelApp.quantityFormatter.formatQuantity(this.sheetToWorldScale !== undefined ? this.sheetToWorldScale * this.sheetToWorldScale * this.area: this.area, areaFormatter));

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
