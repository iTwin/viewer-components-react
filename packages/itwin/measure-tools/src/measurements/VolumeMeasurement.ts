/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import type { Id64String } from "@itwin/core-bentley";
import type { XYZProps } from "@itwin/core-geometry";
import { Geometry, IModelJson, Point3d, PointString3d, PolygonOps } from "@itwin/core-geometry";
import type { GeometryStreamProps } from "@itwin/core-common";
import { BeButtonEvent, type DecorateContext, type GraphicBuilder, type RenderGraphicOwner, type ScreenViewport } from "@itwin/core-frontend";
import { GraphicType, IModelApp, InputSource, QuantityType } from "@itwin/core-frontend";
import { StyleSet, WellKnownGraphicStyleType } from "../api/GraphicStyle";
import type { MeasurementEqualityOptions, MeasurementWidgetData } from "../api/Measurement";
import { Measurement, MeasurementPickContext, MeasurementSerializer } from "../api/Measurement";
import { MeasurementPropertyHelper } from "../api/MeasurementPropertyHelper";
import type { MeasurementProps } from "../api/MeasurementProps";
import { MeasurementSelectionSet } from "../api/MeasurementSelectionSet";
import type { Polygon } from "../api/Polygon";
import { DistanceMeasurement } from "./DistanceMeasurement";
import { MeasureTools } from "../MeasureTools";
import { VolumePolygon } from "../api/VolumePolygon";

/**
 * Props for serializing a [[VolumeMeasurement]].
 */
export interface VolumeMeasurementProps extends MeasurementProps {
  polygonPoints: XYZProps[];
}

/** Serializer for a [[VolumeMeasurement]]. */
export class VolumeMeasurementSerializer extends MeasurementSerializer {
  public static readonly volumeMeasurementName = "volumeMeasurement";

  public get measurementName(): string {
    return VolumeMeasurementSerializer.volumeMeasurementName;
  }

  public isValidType(measurement: Measurement): boolean {
    return measurement instanceof VolumeMeasurement;
  }

  public override isValidJSON(json: any): boolean {
    if (!super.isValidJSON(json) || !json.hasOwnProperty("polygonPoints") || !Array.isArray(json.polygonPoints)) {
      return false;
    }

    return true;
  }

  protected parseSingle(data: MeasurementProps): Measurement | undefined {
    if (!this.isValidJSON(data)) return undefined;

    const props = data as VolumeMeasurementProps;
    return VolumeMeasurement.fromJSON(props);
  }
}

/**
 * Volume measurement. A polygon with formatted volume in a "text pill" at the center.
 */
export class VolumeMeasurement extends Measurement {
  public static override readonly serializer = Measurement.registerSerializer(new VolumeMeasurementSerializer());

  private _polygon: VolumePolygon;

  private _isDynamic: boolean; // No serialize, for dynamics
  protected _dynamicEdge?: DistanceMeasurement; // No serialize, for dynamics

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

  constructor(props?: VolumeMeasurementProps) {
    super(props);

    this._polygon = new VolumePolygon([], false);
    this._polygon.textMarker.setMouseButtonHandler(this.handleTextMarkerButtonEvent.bind(this));
    this._polygon.textMarker.transientHiliteId = this.transientId;
    this._polygon.makeSelectable(true);
    this._isDynamic = false;

    if (props) this.readFromJSON(props);
  }

  protected handleTextMarkerButtonEvent(ev: BeButtonEvent): boolean {
    if (this.isDynamic) return false;

    void this.onDecorationButtonEvent(MeasurementPickContext.createFromSourceId("Invalid", ev));

    return true;
  }

  public addPointToDynamicPolygon(ev: BeButtonEvent): boolean {
    if (!this.isDynamic) return false;

    // Ignore the point if it's the same as the last one
    if (this.polygonPoints.length > 0 && this.polygonPoints[this.polygonPoints.length - 1].isAlmostEqual(ev.point)) return false;

    this.polygonPoints.push(ev.point.clone());
    this.clearCachedGraphics();

    // Check if we should close the polygon, if it's last and first points now equal
    if (ev && this.isSnapToShapeOrigin(ev) && ev.viewport) {
      this.polygonPoints.pop();
      this.polygonPoints.push(this.polygonPoints[0].clone()); // Copy first point to close the polygon
      this.closeDynamicPolygon(ev.viewport);
      return true;
    }

    return false;
  }

  private isSnapToShapeOrigin(ev: BeButtonEvent): boolean {
    if (ev.viewport === undefined || this.polygonPoints.length < 3) return false;

    const firstPtView = ev.viewport.worldToView(this.polygonPoints[0]);
    const snapDistanceView = ev.viewport.pixelsFromInches(
      InputSource.Touch === ev.inputSource ? IModelApp.locateManager.touchApertureInches : IModelApp.locateManager.apertureInches,
    );
    const isWithinDistance = firstPtView.distanceXY(ev.viewPoint) <= snapDistanceView;
    const isAlmostEqual = this.polygonPoints[0].isAlmostEqual(this.polygonPoints[this.polygonPoints.length - 1]);
    return isWithinDistance || isAlmostEqual;
  }

  public updateDynamicPolygon(point: Point3d, recompute?: boolean): void {
    if (!this.isDynamic) return;

    const length = this.polygonPoints.length;
    if (length === 0) return;

    const start = this.polygonPoints[length - 1];
    this._dynamicEdge = DistanceMeasurement.create(start, point);
    if (this.drawingMetadata?.origin) this._dynamicEdge.drawingMetadata = { origin: this.drawingMetadata.origin, worldScale: this.worldScale };
    this._dynamicEdge.sheetViewId = this.sheetViewId;
    this._dynamicEdge.viewTarget.copyFrom(this.viewTarget);
    this._dynamicEdge.style = this.style;
    this._dynamicEdge.lockStyle = this.lockStyle;
    this._dynamicEdge.isDynamic = true;
    this._dynamicEdge.showAxes = false;
    this._dynamicEdge.displayLabels = this.displayLabels;
    if (recompute) {
      this._polygon.recomputeFromPoints();
    }
  }

  public closeDynamicPolygon(targetView: ScreenViewport): boolean {
    if (!this.isDynamic || !this.isValidPolygon) return false;

    this._polygon.recomputeFromPoints(targetView);
    this._dynamicEdge = undefined;
    this.isDynamic = false;
    return true;
  }

  public override testDecorationHit(pickContext: MeasurementPickContext): boolean {
    if (this.transientId && this.transientId === pickContext.geomId) return true;

    if (pickContext.buttonEvent && this.displayLabels) return this._polygon.textMarker.pick(pickContext.buttonEvent.viewPoint);

    return false;
  }

  public override getDecorationGeometry(_pickContext: MeasurementPickContext): GeometryStreamProps | undefined {
    if (this.polygonPoints.length === 0) return undefined;

    // If dynamic, only want to return the first snap point, because as we're laying out a dynamic polygon we want to be able to snap to itself at the first point
    if (this.isDynamic) {
      if (this.polygonPoints.length >= 3) return [IModelJson.Writer.toIModelJson(PointString3d.create(this.polygonPoints[0]))];

      return undefined;
    }

    return [IModelJson.Writer.toIModelJson(PointString3d.create(this.polygonPoints))];
  }

  public override async getDecorationToolTip(_pickContext: MeasurementPickContext): Promise<HTMLElement | string> {
    if (this.isDynamic) return MeasureTools.localization.getLocalizedString("MeasureTools:Measurements.closePolygon");

    return MeasureTools.localization.getLocalizedString("MeasureTools:Measurements.volumeMeasurement");
  }

  protected getSnapId(): string | undefined {
    if (!this.transientId) this.transientId = MeasurementSelectionSet.nextTransientId;

    // We participate even during dynamics, so we can snap to the first point to close. But it only makes sense to do so if there are 3 or more points.
    if (this.isDynamic && this.polygonPoints.length < 3) return undefined;

    return this.transientId;
  }

  public clearDynamicEdge() {
    this._dynamicEdge = undefined;
  }

  public clearCachedGraphics() {
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

  protected addDynamicSnapGraphic(styleSet: StyleSet, context: DecorateContext): void {
    if (!this.isDynamic || this.polygonPoints.length === 0) return;

    // Add a graphic just for snapping to the first point if we can
    const firstPtSnapId = this.getSnapId();
    if (firstPtSnapId === undefined) return;

    const builder = context.createGraphicBuilder(GraphicType.WorldOverlay, undefined, firstPtSnapId);

    // Make sure it's the same symbology as the polygon drawing code
    const ev = new BeButtonEvent();
    IModelApp.toolAdmin.fillEventFromCursorLocation(ev);
    if (!ev.viewport) {
      return;
    }
    const firstPtView = context.viewport.worldToView(this.polygonPoints[0]);
    firstPtView.z = 0;
    const isComplete = this.isSnapToShapeOrigin(ev);
    const style = styleSet.getGraphicStyle(WellKnownGraphicStyleType.AreaMeasurementDynamic)!.clone();
    style.lineWidth += 11;
    const lineColor = isComplete ? context.viewport.hilite.color.tbgr : style.lineColor;
    style.lineColor = lineColor;
    style.addStyledPointString(builder, [this.polygonPoints[0]], false);
    context.addDecorationFromBuilder(builder);
  }

  public override onDrawingMetadataChanged(): void {
    this.polygon.worldScale = this.worldScale;
    this._polygon.recomputeFromPoints();
  }

  public override decorate(context: DecorateContext): void {
    super.decorate(context);

    if (this.polygonPoints.length === 0) return;

    const styleTheme = StyleSet.getOrDefault(this.activeStyle);
    const snapId = !this.isDynamic ? this.getSnapId() : undefined;

    if (this.isDynamic) {
      this.addDynamicSnapGraphic(styleTheme, context);

      if (this._dynamicEdge) this._dynamicEdge.decorate(context);

      const dynamicGBuilde = context.createGraphicBuilder(GraphicType.WorldOverlay);
      this.drawDynamicArea(styleTheme, dynamicGBuilde);
      context.addDecorationFromBuilder(dynamicGBuilde);

      if (!this._cachedGraphic) {
        const polygonGBuilder = context.createGraphicBuilder(GraphicType.WorldOverlay);
        this.drawDynamicPolygonShape(styleTheme, polygonGBuilder);
        this._cachedGraphic = IModelApp.renderSystem.createGraphicOwner(polygonGBuilder.finish());
      }
    } else {
      if (!this._cachedGraphic) {
        const polygonGBuilder = context.createGraphicBuilder(GraphicType.WorldOverlay, undefined, snapId);
        this._polygon.addToGraphicBuilder(polygonGBuilder);
        this._cachedGraphic = IModelApp.renderSystem.createGraphicOwner(polygonGBuilder.finish());
      }
    }

    if (this._cachedGraphic) context.addDecoration(GraphicType.WorldOverlay, this._cachedGraphic);

    if (0.0 < this._polygon.area && this.displayLabels) this._polygon.drawTextMarker(context);
  }

  private drawDynamicArea(styleSet: StyleSet, graphicBuilder: GraphicBuilder): void {
    if (!this._dynamicEdge || this.polygonPoints.length === 0 || !this.polygon.drawFillArea) return;

    const first = this.polygonPoints[0];
    const last = this._dynamicEdge.startPointRef;
    const dynamic = this._dynamicEdge.endPointRef;
    const pointsOnTemporaryShape = [first, last, dynamic];
    const style = styleSet.getGraphicStyle(WellKnownGraphicStyleType.AreaMeasurementDynamic)!;
    style.addStyledShape(graphicBuilder, pointsOnTemporaryShape, false);
  }

  private drawDynamicPolygonShape(styleSet: StyleSet, graphicBuilder: GraphicBuilder): void {
    if (this.polygonPoints.length === 0) return;

    // If drawing with fill, use the dynamic style. If not, use the regular style since it'll just be the outline (by default dynamic is lighter in color/transparency)
    const outlineStyleType = this.polygon.drawFillArea ? WellKnownGraphicStyleType.AreaMeasurementDynamic : WellKnownGraphicStyleType.AreaMeasurement;
    const style = styleSet.getGraphicStyle(outlineStyleType)!;
    style.addStyledPointString(graphicBuilder, this.polygonPoints, false);
    style.addStyledLineString(graphicBuilder, this.polygonPoints, false);

    if (this.polygon.drawFillArea) {
      const style2 = styleSet.getGraphicStyle(WellKnownGraphicStyleType.AreaMeasurement)!;
      style2.addStyledShape(graphicBuilder, this.polygonPoints, false);
    }
  }

  protected override async getDataForMeasurementWidgetInternal(): Promise<MeasurementWidgetData> {
    const lengthSpec = await IModelApp.quantityFormatter.getFormatterSpecByQuantityType(QuantityType.LengthEngineering);
    const areaSpec = await IModelApp.quantityFormatter.getFormatterSpecByQuantityType(QuantityType.Area);
    const volumeSpec = await IModelApp.quantityFormatter.getFormatterSpecByQuantityType(QuantityType.Volume);

    const fPerimeter = IModelApp.quantityFormatter.formatQuantity(this.worldScale * this._polygon.perimeter, lengthSpec);
    const fArea = IModelApp.quantityFormatter.formatQuantity(this.worldScale * this.worldScale * this._polygon.area, areaSpec);
    const fEdgeCount = (this._polygon.points.length - 1).toFixed();

    let fVolume: string = "";
    let fCut: string = "";
    let fFill: string = "";
    if (this._polygon.volume && this._polygon.cut && this._polygon.fill) {
      fVolume = IModelApp.quantityFormatter.formatQuantity(this.worldScale * this.worldScale * this.worldScale * this._polygon.volume, volumeSpec);
      fCut = IModelApp.quantityFormatter.formatQuantity(this.worldScale * this.worldScale * this.worldScale * this._polygon.cut, volumeSpec);
      fFill = IModelApp.quantityFormatter.formatQuantity(this.worldScale * this.worldScale * this.worldScale * this._polygon.fill, volumeSpec);
    } else {
      const volume = await this._polygon.recomputeFromPoints();
      if (volume) {
        fVolume = IModelApp.quantityFormatter.formatQuantity(this.worldScale * this.worldScale * this.worldScale * volume.net, volumeSpec);
        fCut = IModelApp.quantityFormatter.formatQuantity(this.worldScale * this.worldScale * this.worldScale * volume.cut, volumeSpec);
        fFill = IModelApp.quantityFormatter.formatQuantity(this.worldScale * this.worldScale * this.worldScale * volume.fill, volumeSpec);
      }
    }

    const title = MeasureTools.localization.getLocalizedString("MeasureTools:tools.MeasureVolume.toolTitle").replace("{0}", fVolume);

    const data: MeasurementWidgetData = { title, properties: [] };
    MeasurementPropertyHelper.tryAddNameProperty(this, data.properties);

    data.properties.push({
      label: MeasureTools.localization.getLocalizedString("MeasureTools:tools.MeasureVolume.net"),
      name: "VolumeMeasurement_Volume",
      value: fVolume,
      aggregatableValue: volumeSpec && this._polygon.volume ? { value: this._polygon.volume, formatSpec: volumeSpec } : undefined,
    });

    data.properties.push(
      {
        label: MeasureTools.localization.getLocalizedString("MeasureTools:tools.MeasureVolume.cut"),
        name: "VolumeMeasurement_Cut",
        value: fCut,
      },
      {
        label: MeasureTools.localization.getLocalizedString("MeasureTools:tools.MeasureVolume.fill"),
        name: "VolumeMeasurement_Fill",
        value: fFill,
      },
      {
        label: MeasureTools.localization.getLocalizedString("MeasureTools:tools.MeasureArea.popupArea"),
        name: "VolumeMeasurement_Area",
        value: fArea,
      },
      {
        label: MeasureTools.localization.getLocalizedString("MeasureTools:tools.MeasureArea.popupPerimeter"),
        name: "VolumeMeasurement_Perimeter",
        value: fPerimeter,
      },
      {
        label: MeasureTools.localization.getLocalizedString("MeasureTools:tools.MeasureArea.popupEdgeCount"),
        name: "VolumeMeasurement_EdgeCount",
        value: fEdgeCount,
      },
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
  public override equals(other: Measurement, opts?: MeasurementEqualityOptions): boolean {
    if (!super.equals(other, opts)) return false;

    // Compare data (ignore isDynamic)
    const tol = opts && opts.tolerance !== undefined ? opts.tolerance : Geometry.smallMetricDistance;
    const otherVolume = other as VolumeMeasurement;
    if (!otherVolume || this.polygonPoints.length !== otherVolume.polygonPoints.length) return false;

    const thisPts = this.polygonPoints;
    const otherPts = otherVolume.polygonPoints;

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

    if (other instanceof VolumeMeasurement) {
      this.polygon.setPoints(other.polygonPoints, true, true);
      this.isDynamic = other.isDynamic;

      if (this.isDynamic && other._dynamicEdge) this.updateDynamicPolygon(other._dynamicEdge.endPointRef);
    }
  }

  /**
   * Deserializes properties (if they exist) from the JSON object.
   * @param json JSON object to read data from.
   */
  protected override readFromJSON(json: MeasurementProps) {
    super.readFromJSON(json);

    const jsonVolume = json as VolumeMeasurementProps;
    if (jsonVolume.polygonPoints !== undefined) {
      const pts = new Array<Point3d>();
      for (const pt of jsonVolume.polygonPoints) pts.push(Point3d.fromJSON(pt));

      this._polygon.setPoints(pts, false, true);

      if (this.isDynamic && this._dynamicEdge) this.updateDynamicPolygon(this._dynamicEdge.endPointRef, true);
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

    const jsonVolume = json as VolumeMeasurementProps;
    jsonVolume.polygonPoints = pts;
  }

  public static create(pts: Point3d[], viewType?: string): VolumeMeasurement {
    // Don't ned to serialize the points, will just work as is
    const measurement = new VolumeMeasurement({ polygonPoints: pts });
    if (viewType) measurement.viewTarget.include(viewType);

    return measurement;
  }

  public static fromJSON(data: VolumeMeasurementProps): VolumeMeasurement {
    return new VolumeMeasurement(data);
  }
}
