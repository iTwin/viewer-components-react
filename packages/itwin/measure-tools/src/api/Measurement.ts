/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { UiFramework } from "@itwin/appui-react";
import type { Id64String } from "@itwin/core-bentley";
import type { GeometryStreamProps } from "@itwin/core-common";
import type { DecorateContext, HitDetail } from "@itwin/core-frontend";
import { BeButton, BeButtonEvent, IModelApp } from "@itwin/core-frontend";
import type { Point3d, Transform, XYProps } from "@itwin/core-geometry";
import { Point2d } from "@itwin/core-geometry";
import type { FormatterSpec } from "@itwin/core-quantity";
import { MeasurementButtonHandledEvent, WellKnownMeasurementStyle, WellKnownViewType } from "./MeasurementEnums";
import { MeasurementPreferences } from "./MeasurementPreferences";
import type { MeasurementProps } from "./MeasurementProps";
import { MeasurementViewTarget } from "./MeasurementViewTarget";
import { ShimFunctions } from "./ShimFunctions";

/** A property value on a measurement that can be aggregated with other similarly-named properties from other measurements so aggregate totals can be displayed in the UI. */
export interface AggregatableValue {
  // Raw property value
  value: number;

  // Formatter used to format this value
  formatSpec: FormatterSpec;
}

/** Property value information to represent a value from a measurement in the UI. */
export interface WidgetValue {
  // Display label
  label: string;

  // Non-localized name or ID
  name: string;

  // Formatted value
  value: string;

  // Optional extended value to aggregate the above data.
  aggregatableValue?: AggregatableValue;
}

/** Interface for property grid data of a measurement. */
export interface MeasurementWidgetData {
  // Title for the UI group that will display the properties.
  title: string;

  // UI properties
  properties: WidgetValue[];
}

export namespace DrawingMetadata {

  export function toJSON(obj: DrawingMetadata | undefined): DrawingMetadataProps | undefined {
    if (obj === undefined)
      return undefined;
    const origin = obj.origin?.toJSONXY();
    const extents = obj.extents?.toJSONXY();
    if (origin !== undefined)
      return { origin, extents, worldScale: obj.worldScale, drawingId: obj.drawingId };
    return undefined;
  }

  export function fromJSON(json: DrawingMetadataProps): DrawingMetadata {

    return { origin: Point2d.fromJSON(json.origin), worldScale: json.worldScale, drawingId: json.drawingId, extents: Point2d.fromJSON(json.extents)};

  }

  // Returns a new DrawingMetaData object with one or more properties changed.
  export function withOverrides(current: DrawingMetadata, overrides?: Partial<DrawingMetadata>): DrawingMetadata {
    return { ...current, ...overrides };
  }
}

/** Abstract class for serializers that read/write measurements from JSON. */
export abstract class MeasurementSerializer {

  /** Gets the unique measurement name. This is the property that the serializer looks for on incoming JSON data and writes to when serializing. */
  public abstract get measurementName(): string;

  /** Given a JSON object, a single or an array of Measurements is attempted to be parsed.
   * @param data JSON object or undefined.
   * @returns Single or Multiple measurements or undefined if data could not be parsed correctly.
   */
  public parse(data: any): Measurement | Measurement[] | undefined {
    if (data === undefined)
      return undefined;

    const propName = this.measurementName;
    const propValue = data[propName];

    if (propValue === undefined)
      return undefined;

    const measurements: Measurement[] = [];
    const arr = Array.isArray(propValue) ? propValue : [propValue];
    for (const elem of arr) {
      const elemMeasurement = this.parseSingle(elem);
      if (elemMeasurement !== undefined)
        measurements.push(elemMeasurement);
    }

    if (measurements.length === 0)
      return undefined;

    // Avoid returning arrays of a single measurement...
    return (measurements.length === 1) ? measurements[0] : measurements;
  }

  /** Serializes single or multiple measurements to a JSON object.
   * @param measurement Single or multiple measurements.
   * @returns JSON object that will have a single property (the measurementName) or undefined if serialization failed.
   */
  public serialize(measurement: Measurement | Measurement[]): any {
    if (!this.areValidTypes(measurement))
      return undefined;

    const propName = this.measurementName;

    const jsonArray: any[] = [];
    const arr = Array.isArray(measurement) ? measurement : [measurement];
    for (const elem of arr) {
      const jsonValue = this.serializeSingle(elem);
      if (jsonValue !== undefined)
        jsonArray.push(jsonValue);
    }

    if (jsonArray.length === 0)
      return undefined;

    const propValue = (jsonArray.length === 1) ? jsonArray[0] : jsonArray;
    return { [propName]: propValue };
  }

  /** Determines if the measurements are all the same type. Serializers do not handle an array of differently typed measurements.
   * @param measurement One or more measurements to check
   * @returns true if all measurements are of the same type, false if otherwise.
   */
  public areValidTypes(measurement: Measurement | Measurement[]): boolean {

    const arr = Array.isArray(measurement) ? measurement : [measurement];
    if (arr.some((elem) => elem === undefined || !this.isValidType(elem)))
      return false;

    return true;
  }

  /** Subclasses need to implement this to do type checking.
   * @param measurement Measurement to check.
   * @returns true if the measurement is a valid type, false if otherwise.
   */
  public abstract isValidType(measurement: Measurement): boolean;

  /**
   * Subclases can implement this to do JSON data validation. Some measurements may have optional properties, other measurements may need data that HAS to be present in order to
   * create a new instance.
   * @param json JSON data to validate.
   */
  public isValidJSON(_json: any): boolean {
    // Currently all measurement base props are optional
    return true;
  }

  /** Subclasses need to implement this to handle parsing a measurement type from JSON.
   * @param data JSON data to parse.
   * @returns Measurement instance or undefined if parsing failed.
   */
  protected abstract parseSingle(data: MeasurementProps): Measurement | undefined;

  /** Handles serializing a measurement type to JSON.
   * @param measurement Measurement instance to serialize.
   * @returns JSON object with measurement props.
   */
  protected serializeSingle(measurement: Measurement): MeasurementProps | undefined {
    if (this.isValidType(measurement))
      return measurement.toJSON();

    return undefined;
  }
}

/** Defines the context for testing if a measurement is being picked. */
export class MeasurementPickContext {
  /** Geometry ID that was picked. */
  public readonly geomId: string;

  /** Optional extended information about the pick hit on the geometry. */
  public readonly hitDetail?: HitDetail;

  /** Optional extended information about the button event that generated the pick. */
  public readonly buttonEvent?: BeButtonEvent;

  /**
   * Constructs a new pick detail.
   * @param geomId Geometry ID that was picked.
   * @param hitDetail Optional information about the pick hit on the geometry.
   * @param ev Optional information about the button event that generated the pick.
   */
  public constructor(geomId: string, hitDetail?: HitDetail, ev?: BeButtonEvent) {
    this.geomId = geomId;
    this.hitDetail = hitDetail;
    this.buttonEvent = ev;
  }

  /**
   * Creates a pick detail from the supplied arguments.
   * @param hitDetail HitDetail containing the pick information.
   * @param ev Button event, if undefined the current input state is queried.
   */
  public static create(hitDetail: HitDetail, ev?: BeButtonEvent): MeasurementPickContext {
    if (!ev) {
      ev = new BeButtonEvent();
      IModelApp.toolAdmin.fillEventFromLastDataButton(ev);
    }

    return new MeasurementPickContext(hitDetail.sourceId, hitDetail, ev);
  }

  /**
   * Creates a pick detail from the supplied arguments.
   * @param geomId Geometry ID that was picked
   * @param ev Button event, if undefined the current input state is queried.
   */
  public static createFromSourceId(geomId: string, ev?: BeButtonEvent): MeasurementPickContext {
    if (!ev) {
      ev = new BeButtonEvent();
      IModelApp.toolAdmin.fillEventFromLastDataButton(ev);
    }

    return new MeasurementPickContext(geomId, undefined, ev);
  }
}

/** Represents how two measurements should be compared to in an equality test. If data-equality is desired, use some of these options to turn off checks for base properties. */
export interface MeasurementEqualityOptions {
  /** If true, ignore styling properties when comparing. */
  ignoreStyle?: true | undefined;

  /** If true, ignore view target contents when comparing. */
  ignoreViewTarget?: true | undefined;

  /** If true, ignore any ID information (grouping or otherwise). */
  ignoreIds?: true | undefined;

  /** If true, ignore the measurement labels. */
  ignoreLabel?: true | undefined;

  /** If true, ignore any other non-data state information, such as if the measurement's lock state. When combined with the other ignore options, the equality will not test base measurement properties. */
  ignoreNonDataState?: true | undefined;

  /** Tolerance for numerical equality (usually [[Geometry.smallMetricDistance]] is a default). */
  tolerance?: number;

  /** Tolerance for angle equality, if needed (usually [[Geometry.smallAngleRadians]] is a default). */
  angleTolerance?: number;
}

export interface DrawingMetadataProps extends Omit<DrawingMetadata, "origin" | "extents"> {
  origin: XYProps;
  extents?: XYProps;
}

export interface DrawingMetadata {
  /** Id of the drawing */
  drawingId?: string;

  /** Scaling from sheet to world distance */
  worldScale: number;

  /** Origin of the drawing in sheet coordinates */
  origin: Point2d;

  /** Extents of the drawing in sheet coordinates */
  extents?: Point2d;

  /** Represents the transform from sheet points to 3d points */
  transform?: Transform;

}

/** Handler function that modifies the data sent to the widget for display. */
export type MeasurementDataWidgetHandlerFunction = (m: Measurement, currentData: MeasurementWidgetData) => Promise<void>;
/** Handler for modifying the data sent to the widget for display. The highest priority will execute last. */
export interface MeasurementDataWidgetHandler { priority: number, handlerFunction: MeasurementDataWidgetHandlerFunction }
/**
 * Abstract class representing a Measurement. Measurements are semi-persistent annotation objects that can be drawn to a viewport. They are not stored
 * in the imodel database, but can be serialized to a JSON string for storage.
 */
export abstract class Measurement {
  private static _serializers = new Map<string, MeasurementSerializer>();
  private static _dataForMeasurementWidgetHandlers: MeasurementDataWidgetHandler[] = [];

  private _isLocked: boolean;
  private _groupId?: string;
  private _subgroupId?: string;
  private _id?: string;
  private _label?: string;
  private _style?: string;
  private _lockStyle?: string;

  private _viewTarget: MeasurementViewTarget;
  private _displayLabels: boolean;
  private _transientId?: Id64String; // Not serialized
  private _isVisible: boolean; // Not serialized

  // Used for sheet measurements
  private _drawingMetaData?: DrawingMetadata;

  /** Default drawing style name. */
  public static readonly defaultStyle: string = WellKnownMeasurementStyle.Default;

  /** Default locked drawing styl name. */
  public static readonly defaultLockStyle: string = WellKnownMeasurementStyle.DefaultLocked;

  /** Each subclass should register and set a serializer object for itself to this property. If undefined, the measurement does not participate in serialization. */
  public static readonly serializer: MeasurementSerializer | undefined;

  /** Gets the serializer associated with this measurement type. If undefined, the measurement does not participate in serialization. */
  public get serializer(): MeasurementSerializer | undefined {
    return Object.getPrototypeOf(this).constructor.serializer;
  }

  /** Gets or sets the transient ID used by this measurement. This enables using measurements with selection, snapping, and picking.
   * Subclasses should get a transient ID when needed from the imodel in the global @see [[MeasurementSelectionSet]]. If the imodel
   * changes, the transient ID of all measurements is reset. Normally you do not need to do this yourself.
   */
  public get transientId(): Id64String | undefined {
    return this._transientId;
  }

  public set transientId(newId: Id64String | undefined) {
    const prevId = this._transientId;
    this._transientId = newId;
    this.onTransientIdChanged(prevId);
  }

  public get drawingMetaData(): Readonly<DrawingMetadata | undefined> {
    return this._drawingMetaData;
  }

  public set drawingMetaData(data: DrawingMetadata | undefined) {
    this._drawingMetaData = data;
    this.onDrawingMetadataChanged();
  }

  public get worldScale(): Readonly<number> {
    return this.drawingMetaData?.worldScale ?? 1.0;
  }

  public set sheetViewId(id: string | undefined) {
    this.viewTarget.addViewIds(id ?? []);
  }

  /** Gets or sets if the measurement should be drawn. */
  public get isVisible(): boolean {
    return this._isVisible;
  }

  public set isVisible(v: boolean) {
    this._isVisible = v;
  }

  /** Gets or sets if the measurement is locked. Locked measurements have a different styling, cannot be edited, and cannot be cleared by the clear measurement tool. */
  public get isLocked(): boolean {
    return this._isLocked;
  }

  public set isLocked(value: boolean) {
    // Do nothing if state didn't actually change
    if (this._isLocked === value)
      return;

    this._isLocked = value;
    this.onLockToggled();
  }

  /** Gets or sets the group ID for the measurement. This is used to categorize the measurement in a meaningful way to the application. */
  public get groupId(): string | undefined {
    return this._groupId;
  }

  public set groupId(value: string | undefined) {
    const prevGroupId = this._groupId;
    this._groupId = value;
    this.onGroupIdChanged(prevGroupId);
  }

  /** Gets or sets the subgroup ID for the measurement. This is used to categorize the measurement in a meaningful way to the application. */
  public get subgroupId(): string | undefined {
    return this._subgroupId;
  }

  public set subgroupId(value: string | undefined) {
    const prevSubgroupId = this._subgroupId;
    this._subgroupId = value;
    this.onSubGroupIdChanged(prevSubgroupId);
  }

  /** Gets or sets the ID for the measurement. This is used to categorize the measurement in a meaningful way to the application. */
  public get id(): string | undefined {
    return this._id;
  }

  public set id(value: string | undefined) {
    const prevId = this._id;
    this._id = value;
    this.onIdChanged(prevId);
  }

  /** Gets or sets the display label for the measurement. */
  public get label(): string | undefined {
    return this._label;
  }

  public set label(value: string | undefined) {
    const prevLabel = this._label;
    this._label = value;
    this.onLabelChanged(prevLabel);
  }

  /** Gets or sets the mame of the StyleSet to apply when drawing this measurement. If undefined, the default style is used. */
  public get style(): string | undefined {
    return this._style;
  }

  public set style(value: string | undefined) {
    const prevStyle = this._style;
    this._style = value;
    this.onStyleChanged(false, prevStyle);
  }

  /** Gets or sets the name of the StyleSet to apply when drawing this measurement when it is locked. If undefined, the default lock style is used. */
  public get lockStyle(): string | undefined {
    return this._lockStyle;
  }

  public set lockStyle(value: string | undefined) {
    const prevStyle = this._lockStyle;
    this._lockStyle = value;
    this.onStyleChanged(true, prevStyle);
  }

  /**
   * Computes the active style for the measurement.
   * @returns the active style based on the locking flag.  If the style is undefined, the default style is returned (default when unlocked, default-locked when locked).
   */
  public get activeStyle(): string {
    if (this.isLocked) {
      return (this._lockStyle) ? this._lockStyle : WellKnownMeasurementStyle.DefaultLocked;
    } else {
      return (this._style) ? this._style : WellKnownMeasurementStyle.Default;
    }
  }

  /** Gets the views this measurement targets. */
  public get viewTarget(): MeasurementViewTarget {
    return this._viewTarget;
  }

  public get displayLabels(): boolean { return this._displayLabels; }
  public set displayLabels(display: boolean) {
    if (this._displayLabels !== display) {
      this._displayLabels = display;
      this.onDisplayLabelsToggled();
    }
  }

  /** Communicates to the action toolbar this measurement wants to participate in actions. */
  public get allowActions(): boolean { return true; }

  /** Protected constructor */
  protected constructor(props?: MeasurementProps) {
    this._isLocked = false;
    this._isVisible = true;
    this._displayLabels = MeasurementPreferences.current.displayMeasurementLabels;
    this._viewTarget = new MeasurementViewTarget();
    if (props?.drawingMetadata)
      this.drawingMetaData = DrawingMetadata.fromJSON(props.drawingMetadata);
  }

  /** Copies the measurement data into a new instance.
   * @returns clone of this measurement.
   */
  public clone<T extends Measurement>(): T {
    const copy = this.createNewInstance();
    copy.copyFrom(this);
    return copy as T;
  }

  /**
   * Serializes the measurement's data into a JSON prop object. Subclasses participate by overriding the writeToJSON method.
   * @returns prop object containing the values of the measurement.
   */
  public toJSON<T extends MeasurementProps>(): T {
    const json: MeasurementProps = {};
    this.writeToJSON(json);

    return json as T;
  }

  /**
   * Tests equality with another measurement.
   * @param other Measurement to test equality for.
   * @param opts Options for equality testing.
   * @returns true if the other measurement is equal, false if some property is not the same or if the measurement is not of the same type.
   */
  public equals(other: Measurement, opts?: MeasurementEqualityOptions): boolean {
    // Reject if not same type
    if (Object.getPrototypeOf(this).constructor !== Object.getPrototypeOf(other).constructor)
      return false;

    let ignoreStyle = false;
    let ignoreViewTarget = false;
    let ignoreIds = false;
    let ignoreLabel = false;
    let ignoreNonDataState = false;

    if (opts) {
      if (opts.ignoreStyle)
        ignoreStyle = true;

      if (opts.ignoreViewTarget)
        ignoreViewTarget = true;

      if (opts.ignoreIds)
        ignoreIds = true;

      if (opts.ignoreNonDataState)
        ignoreNonDataState = true;

      if (opts.ignoreLabel)
        ignoreLabel = true;
    }

    if (!ignoreStyle) {
      if (this._style !== other._style || this._lockStyle !== other._lockStyle)
        return false;
    }

    if (!ignoreViewTarget) {
      if (!this._viewTarget.equals(other._viewTarget))
        return false;
    }

    if (!ignoreIds) {
      if (this._id !== other._id || this._subgroupId !== other._subgroupId || this._groupId !== other._groupId)
        return false;
    }

    if (!ignoreLabel) {
      if (this._label !== other._label)
        return false;
    }

    if (!ignoreNonDataState) {
      if (this._isLocked !== other._isLocked)
        return false;

      if (this._displayLabels !== other._displayLabels)
        return false;
    }

    return true;
  }

  /** Draw the measurement. This is called every frame, e.g. when the mouse moves. This is suitable for small or dynamic graphics, but if the measurement
   * has complicated graphics, consider using the decorateCached method.
   * @param context Decorate context for drawing to a viewport.
   */
  public decorate(_context: DecorateContext): void { }

  /** Draw any graphics that need to be cached. This is called when the scene changes, e.g. zoom or rotate.
    * @param context Decorate context for drawing to a viewport.
  */
  public decorateCached(_context: DecorateContext): void { }

  /** Test if the measurement was picked.
   * @param _pickContext Picking context to test against.
   * @returns true if the measurement has been picked, false otherwise.
   */
  public testDecorationHit(_pickContext: MeasurementPickContext): boolean { return false; }

  /** Get a geometry stream representing the pickable geometry of the measurement. Usually this is simplier geometry than what is drawn.
   * @param _pickContext Picking context to test against.
   * @returns a geometry stream of pickable data or undefined.
   */
  public getDecorationGeometry(_pickContext: MeasurementPickContext): GeometryStreamProps | undefined { return undefined; }

  /** Get a tooltip for this measurement.
   * @param _pickContext Picking context to test against.
   * @returns a tooltip HTML element or string.
   */
  public async getDecorationToolTip(_pickContext: MeasurementPickContext): Promise<HTMLElement | string> { return ""; }

  /**
   * Register a handler to modify the behavior of the widget data shown.
   * @param handler Function that modifies the WidgetData
   * @param priority Priority of the handler, highest priority will execute last
   */
  public static registerDataForMeasurementWidgetHandler(handler: MeasurementDataWidgetHandlerFunction, priority = 0) {
    if (undefined === Measurement._dataForMeasurementWidgetHandlers.find((value) => value.handlerFunction === handler)) {
      Measurement._dataForMeasurementWidgetHandlers.push({ priority, handlerFunction: handler });
      return true;
    } else
      throw new Error("This MeasurementDataWidgetHandlerFunction is already registered.");
  }

  /**
   * Gets formatted property data for the measurement UI widget.
   * @returns promise with data or undefined if there is no data to display.
   */
  public async getDataForMeasurementWidget(): Promise<MeasurementWidgetData | undefined> {
    const data = await this.getDataForMeasurementWidgetInternal();
    if (data !== undefined) {
      for (const handler of Measurement._dataForMeasurementWidgetHandlers.sort((h) => h.priority))
        await handler.handlerFunction(this, data);
    }

    return data;
  }

  /**
   * Gets formatted property data for the measurement UI widget.
   * @returns promise with data or undefined if there is no data to display.
   */
  protected async getDataForMeasurementWidgetInternal(): Promise<MeasurementWidgetData | undefined> { return undefined; }

  /**
   * Responds to a button event. By default this tests if the measurement was picked and opens the action toolbar.
   * @param pickContext Picking context to test against.
   * @returns Whether or not the event was handled.
   */
  public async onDecorationButtonEvent(pickContext: MeasurementPickContext): Promise<MeasurementButtonHandledEvent> {
    const ev = pickContext.buttonEvent;
    if (!ev)
      return MeasurementButtonHandledEvent.No;

    // If left clicked, we want to select. If right we want to open the context toolbar. To select we should not consume the event.
    if (this.testDecorationHit(pickContext)) {
      if (ev.button === BeButton.Reset && !ev.isDown && !ev.isAltKey && !ev.isControlKey && !ev.isShiftKey && !ev.isAltKey && !ev.isDragging && !ev.isDoubleClick) {
        ShimFunctions.defaultButtonEventAction!(this, pickContext);
        return MeasurementButtonHandledEvent.YesConsumeEvent;
      }

      return MeasurementButtonHandledEvent.Yes;
    }

    return MeasurementButtonHandledEvent.No;
  }

  /** Cleans up any resources (e.g. IDisposable objects) */
  public onCleanup() { }

  /** Adjusts a point to account for Global Origin. This is required in order to display coordinates as text.
   * May return a reference to the original point, or a new point if the global origin is applied
   */
  protected adjustPointForGlobalOrigin(point: Point3d): Readonly<Point3d> {
    if (this.viewTarget.isOfViewType(WellKnownViewType.AnySpatial)) {
      const iModel = UiFramework.getIModelConnection();
      if (iModel) {
        const globalOrigin = iModel.globalOrigin;
        return point.minus(globalOrigin);
      }
    }
    return point;
  }

  /**
   * Creates a new instance of the measurement subclass. This works well for most subclasses that have a parameterless constructor (or one that takes in an optional props object).
   * Otherwise, the subclass should override this if it has special needs to correctly instantiate a new instance of itself.
   */
  protected createNewInstance(): Measurement {
    const ctor = Object.getPrototypeOf(this).constructor;
    return new ctor();
  }

  /**
   * Copies data from the other measurement into this instance.
   * @param other Measurement to copy property values from.
   */
  protected copyFrom(other: Measurement) {
    // We do want the onXYZ methods called so not using the private variables
    this.isLocked = other.isLocked;
    this.groupId = other.groupId;
    this.subgroupId = other.subgroupId;
    this.id = other.id;
    this.label = other.label;
    this.style = other.style;
    this.lockStyle = other.lockStyle;
    this.viewTarget.copyFrom(other.viewTarget);
    this.displayLabels = other.displayLabels;
    if (other.drawingMetaData)
      this._drawingMetaData = { origin: other.drawingMetaData.origin.clone(), worldScale: other.drawingMetaData.worldScale, drawingId: other.drawingMetaData.drawingId, extents: other.drawingMetaData.extents};
  }

  /**
   * Deserializes properties (if they exist) from the JSON object.
   * @param json JSON object to read data from.
   */
  protected readFromJSON(json: MeasurementProps) {
    this._isLocked = (json.isLocked !== undefined) ? json.isLocked : false;
    this._groupId = (json.groupId !== undefined) ? json.groupId : undefined;
    this._subgroupId = (json.subgroupId !== undefined) ? json.subgroupId : undefined;
    this._id = (json.id !== undefined) ? json.id : undefined;
    this._label = (json.label !== undefined) ? json.label : undefined;
    this._style = (json.style !== undefined) ? json.style : undefined;
    this._lockStyle = (json.style !== undefined) ? json.lockStyle : undefined;
    this._displayLabels = (json.displayLabels !== undefined) ? json.displayLabels : MeasurementPreferences.current.displayMeasurementLabels;

    if (json.drawingMetadata !== undefined)
      this.drawingMetaData = DrawingMetadata.fromJSON(json.drawingMetadata);

    if (json.viewTarget !== undefined) {
      this._viewTarget.loadFromJSON(json.viewTarget);
    } else {
      this._viewTarget.clear(); // Default to "Any" if nothing incoming
    }

    // Ensure we can read the old legacy way some measurements serialized view information (not all did this), if this exists then
    // the json will not have a viewTarget so will default to "Any" (and skip if the value = 0 which also meant "Any").
    const jsonAny = json as any;
    if (jsonAny.viewportType !== undefined) {
      const legacyVpType = (json as any).viewportType;
      if (typeof legacyVpType === "number") {
        switch (legacyVpType) {
          case 1: // MainOnly
            this._viewTarget.include(WellKnownViewType.Spatial);
            break;
          case 2: // XSection
            this._viewTarget.include(WellKnownViewType.XSection);
            break;
          case 3: // Profile
            this._viewTarget.include(WellKnownViewType.Profile);
            break;
        }
      }
    }
  }

  /**
   * Serializes properties to a JSON object.
   * @param json JSON object to append data to.
   */
  protected writeToJSON(json: MeasurementProps) {
    json.isLocked = this._isLocked;
    json.groupId = this._groupId;
    json.subgroupId = this._subgroupId;
    json.id = this._id;
    json.label = this._label;
    json.style = this._style;
    json.lockStyle = this._lockStyle;
    json.viewTarget = this._viewTarget.toJSON();
    json.displayLabels = this._displayLabels;
    const drawingMetaDataJson = DrawingMetadata.toJSON(this.drawingMetaData);
    if (drawingMetaDataJson)
      json.drawingMetadata = drawingMetaDataJson;
  }

  /** Notify subclasses that style options have changed. This is to allow implementations to regenerate any cached graphics.
   * @param _isLock true if the lock style was changed, false if the regular style.
   * @param _prevStyle The previous style name.
   */
  protected onStyleChanged(_isLock: boolean, _prevStyle?: string) { }

  /** Notify subclasses the group ID changed.
   * @param _prevGroupid The previous group ID.
   */
  protected onGroupIdChanged(_prevGroupid?: string) { }

  /** Notify subclasses the subgroup ID changed.
   * @param _prevSubgroupId The previous subgroup ID.
   */
  protected onSubGroupIdChanged(_prevSubgroupId?: string) { }

  /** Notify subclasses the ID changed.
   * @param _prevId The previous ID.
   */
  protected onIdChanged(_prevId?: string) { }

  /**
   * Notify subclasses the label changed.
   * @param _prevLabel The previous label value.
   */
  protected onLabelChanged(_prevLabel?: string) { }

  /** Notify subclasses when the measurement's lock is toggled. */
  protected onLockToggled() { }

  /** Notify subclasses when the display units have changed. */
  public onDisplayUnitsChanged(): void { }

  /** Notify subclasses when the transient ID has changed.
   * @param _prevId The previous ID, if any.
   */
  protected onTransientIdChanged(_prevId?: Id64String): void { }

  /**
   * Notify subclasses when DrawingMetadata changes
   */
  protected onDrawingMetadataChanged(): void { }

  /**
   * Notify subclasses when the display labels property has changed.
   */
  protected onDisplayLabelsToggled(): void { }

  /** Parses a JSON object into a single or multiple measurements.
   * @param data JSON object
   * @returns single or multiple measurements or undefine if parsing failed, or the JSON object is undefined.
   */
  public static parse(data?: any): Measurement | Measurement[] | undefined {
    if (!data)
      return undefined;

    const parsed = new Array<Measurement>();

    // Can have an array where each entry is "measureTypeName: data" or a single object that has multiple "measureTypeName" properties.
    // What's important though is each of the "data" can be a single measurement object or an array of measurement objects. We support lots of ways
    // to organize the data, although the serialize method will output an array of single-property objects if there are multiple types.
    const arr = Array.isArray(data) ? data : [data];
    // For each entry in array...
    for (const entry of arr) {
      // Look at the entry with each registered parser. Each looks for a named property on the object and parses that. Multiple named properties can exist
      // on a single object, so we let each serializer have a shot.
      for (const kv of Measurement._serializers) {
        const serializer = kv[1];
        const measurement = serializer.parse(entry);
        if (!measurement)
          continue;

        if (Array.isArray(measurement))
          parsed.push(...measurement);
        else
          parsed.push(measurement);
      }
    }

    // Avoid returning arrays of one object...
    if (parsed.length > 0)
      return (parsed.length === 1) ? parsed[0] : parsed;

    return undefined;
  }

  /** Parses a JSON object into a single measurement. If the JSON object had multiple measurements, only the first
   * one is returned.
   * @param data JSON object
   * @returns single measurement or undefined if parsing failed.
   */
  public static parseSingle(data?: any): Measurement | undefined {
    const measurement = Measurement.parse(data);
    if (measurement === undefined)
      return undefined;

    if (Array.isArray(measurement) && measurement.length > 0)
      return measurement[0];

    return measurement as Measurement;
  }

  /** Serializes one or more measurements into one or more JSON objects. For each type of measurement, the result will be a JSON object with a single
   * named property representing the measuremnt (e.g. "distanceMeasurement") which itself will either be a single JSON object or an array if more than one. If all measurements
   * are the same type, a single JSON object is returned. If there are multiple measurement types (e.g. distance, area, etc) then an array is returned where each entry is a JSON
   * object with the single named property.
   * @param measurement one or more measurements.
   * @returns undefined if nothing could be serialized OR a single JSON object if all the measurements are of the same type OR an array of JSON objects.
   */
  public static serialize(measurement: Measurement | Measurement[]): any | any[] {
    if (Array.isArray(measurement)) {
      const buckets = new Map<string, Measurement[]>();

      // First pass, bucket all incoming measurements
      for (const m of measurement) {
        if (m === undefined || m.serializer === undefined)
          continue;

        let bucket = buckets.get(m.serializer.measurementName);
        if (!bucket) {
          bucket = new Array<Measurement>();
          buckets.set(m.serializer.measurementName, bucket);
        }

        bucket.push(m);
      }

      if (buckets.size === 0)
        return undefined;

      // Second pass, proces each bucket
      const dataArray = [];
      for (const bucket of buckets) {
        const serializer = Measurement.findSerializer(bucket[0]);
        if (serializer) {
          const data = serializer.serialize(bucket[1]);
          if (data)
            dataArray.push(data);
        }
      }

      // If only one bucket of measurements, avoid returning an array and just return the single entry
      if (dataArray.length === 1)
        return dataArray[0];

      return (dataArray.length > 0) ? dataArray : undefined;
    } else {
      const serializer = measurement.serializer;
      if (serializer) {
        const data = serializer.serialize(measurement);
        if (data)
          return data;
      }
    }

    return undefined;
  }

  /** Registers a measurement serializer that is used in the parse/serialize static methods. Once a serializer is registered, it cannot be dropped.
   * If you need to override a measurement, do so by subclassing the measurement and it's serializer.
   * @param serializer serializer that handles a unique measurement during parsing/serialization.
   * @throws error if the serializer's name is not unique.
   */
  public static registerSerializer(serializer: MeasurementSerializer): MeasurementSerializer | undefined {
    if (Measurement._serializers.has(serializer.measurementName))
      throw new Error(`Measurement serializer names MUST be unique. Duplicate: ${serializer.measurementName}`);

    this._serializers.set(serializer.measurementName, serializer);
    return serializer;
  }

  /**
   * Finds a serializer for the given name.
   * @param measurementName measurement name that a serializer is associated with.
   * @returns the associated serializer or undefined if none exists for the given name.
   */
  public static findSerializer(measurementName: string): MeasurementSerializer | undefined {
    return Measurement._serializers.get(measurementName);
  }

  /**
   * Invalidate decorations for all viewports that can draw the specified measurements.
   * @param measurements Array of measurements to invalidate views for.
   */
  public static invalidateDecorationsForAll(measurements: Measurement[]) {
    if (measurements.length === 0)
      return;

    const target = new MeasurementViewTarget();

    // Only need to look at the included view types for each measurement. If any one measurement is "any", it doesn't matter if it excludes
    // nor do we need to keep collecting view types, since we will most likely need to draw all views. Any whacky cases like include "any" but
    // explicitly exclude all types of views are not considered. We could classify all views and check that, but may as wel Keep It Simple.
    for (const m of measurements) {
      if (m.viewTarget.primary === WellKnownViewType.Any) {
        target.clear();
        break;
      }

      for (const viewType of m.viewTarget.included)
        target.include(viewType);
    }

    target.invalidateViewportDecorations();
  }
}
