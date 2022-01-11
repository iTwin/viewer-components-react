/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { Arc3d, LineSegment3d, Path, Point3d, XYProps } from "@itwin/core-geometry";
import { ColorByName, ColorDef, ColorDefProps, LinePixels } from "@itwin/core-common";
import { GraphicBuilder } from "@itwin/core-frontend";

/** List of well-known graphic styles. */
export enum WellKnownGraphicStyleType {
  AreaMeasurement = "AreaMeasurement",
  AreaMeasurementDynamic = "AreaMeasurementDynamic",
  DistanceMeasurement = "DistanceMeasurement",
  LocationMeasurement = "LocationMeasurement",
  Rise = "Rise",
  Run = "Run",
}

/** Defines the placement of an icon relative to its parent. */
export enum IconAlignment {
  TopLeft = 0,
  Top = 1,
  TopRight = 2,
  Left = 3,
  Center = 4,
  Right = 5,
  BottomLeft = 6,
  Bottom = 7,
  BottomRight = 8,
}

/** Describes a Svg webfont icon that can be drawn with TextMarker */
export interface IconStyleProps {
  iconSpec: string;  // Required, the name of the SVG icon in a webfont package OR a CSS class name
  position?: IconAlignment; // Defaults to center
  offset?: XYProps; // Defaults to zero
  size?: number; // Defaults to an icon's font-size (16px)
  iconColor?: ColorDefProps; // If no color, use whatever is in the icon
  padding?: number; // Defaults to zero
  bgColor?: ColorDefProps; // If no color, no background color
  bgCornerRadius?: number; // Defaults to zero (no corner radius)
  borderWidth?: number; // Defaults to zero width (no border)
  borderColor?: ColorDefProps; // Defaults to black if has width
}

export enum TextOffsetType { Pixels, Percentage }
export interface TextOffsetProps {
  x: number;
  y: number;
  type: TextOffsetType;
}

/** Describes a simple symbology to use with TextMarker */
export interface TextStyleProps {
  textFont: string;
  textLineHeight?: number;
  textColor?: ColorDefProps;
  boxPadding?: number;
  boxCornerRadius?: number;
  boxBorderWidth?: number;
  boxBorderColor?: ColorDefProps;
  boxColor?: ColorDefProps;
  icon?: IconStyleProps;
}

/** List of well-known text styles. */
export enum WellKnownTextStyleType {
  AreaMeasurement = "AreaMeasurement",
  DistanceMeasurement = "DistanceMeasurement",
  LocationMeasurement = "LocationMeasurement",
  Rise = "Rise",
  Run = "Run",
  HoverBox = "HoverBox",
}

/** Describes the properties of a GraphicStyle. */
export interface GraphicStyleProps {
  lineColor: ColorDefProps;
  fillColor: ColorDefProps;
  lineWidth: number;
  linePixels?: LinePixels;
  backgroundColor?: ColorDefProps;
  backgroundLineWidth?: number;
}

export class GraphicStyle implements GraphicStyleProps {
  public static readonly defaultLineWidthPaddingForBackground = 4;
  private _lineColorDef: ColorDef;
  private _fillColorDef: ColorDef;
  public lineWidth: number;
  public linePixels?: LinePixels;
  private _backgroundColorDef?: ColorDef;
  public backgroundLineWidth?: number;

  constructor(props: GraphicStyleProps) {
    this._lineColorDef = ColorDef.fromTbgr(props.lineColor);
    this._fillColorDef = ColorDef.fromTbgr(props.fillColor);
    this.lineWidth = props.lineWidth;
    this.linePixels = props.linePixels;
    this._backgroundColorDef = (undefined !== props.backgroundColor) ? ColorDef.fromTbgr(props.backgroundColor) : undefined;
    this.backgroundLineWidth = props.backgroundLineWidth;
  }

  public get lineColorDef(): ColorDef { return this._lineColorDef; }
  public get lineColor(): ColorDefProps { return this._lineColorDef.toJSON(); }
  public set lineColor(v: ColorDefProps) { this._lineColorDef = ColorDef.fromTbgr(v); }

  public get fillColorDef(): ColorDef { return this._fillColorDef; }
  public get fillColor(): ColorDefProps { return this._fillColorDef.toJSON(); }
  public set fillColor(v: ColorDefProps) { this._fillColorDef = ColorDef.fromTbgr(v); }

  public get backgroundColorDef(): ColorDef | undefined { return this._backgroundColorDef; }
  public get backgroundColor(): ColorDefProps | undefined { return undefined !== this._backgroundColorDef ? this._backgroundColorDef.toJSON() : undefined; }
  public set backgroundColor(v: ColorDefProps | undefined) { this._backgroundColorDef = undefined !== v ? ColorDef.fromTbgr(v) : undefined; }

  /** Adds a Path to the builder with the provided symbology. */
  public addStyledPath(builder: GraphicBuilder, path: Path, useBackground: boolean): void {
    if (useBackground) {
      this.applyBackground(builder);
      builder.addPath(path);
    }
    this.applyStyle(builder);
    builder.addPath(path);
  }

  /** Adds a Point String to the builder with the provided symbology. */
  public addStyledPointString(builder: GraphicBuilder, points: Point3d[], useBackground: boolean): void {
    if (useBackground) {
      this.applyBackground(builder);
      builder.addPointString(points);
    }
    this.applyStyle(builder);
    builder.addPointString(points);
  }

  /** Adds a Line String to the builder with the provided symbology. */
  public addStyledLineString(builder: GraphicBuilder, points: Point3d[], useBackground: boolean): void {
    if (useBackground) {
      this.applyBackground(builder);
      builder.addLineString(points);
    }
    this.applyStyle(builder);
    builder.addLineString(points);
  }

  /** Adds a Line to the builder with the provided symbology. */
  public addStyledLine(builder: GraphicBuilder, line: LineSegment3d, useBackground: boolean): void {
    return this.addStyledLineString(builder, [line.point0Ref, line.point1Ref], useBackground);
  }

  /** Adds a Shape to the builder with the provided symbology. */
  public addStyledShape(builder: GraphicBuilder, points: Point3d[], useBackground: boolean): void {
    if (useBackground) {
      this.applyBackground(builder);
      builder.addShape(points);
    }
    this.applyStyle(builder);
    builder.addShape(points);
  }

  public addStyledArc(builder: GraphicBuilder, arc: Arc3d, useBackground: boolean): void {
    if (useBackground) {
      this.applyBackground(builder);
      builder.addArc(arc, false, false);
    }
    this.applyStyle(builder);
    builder.addArc(arc, false, false);
  }

  private applyBackground(builder: GraphicBuilder): void {
    const color = this.backgroundColorDef || ColorDef.black;
    const lineWidth = this.backgroundLineWidth || (this.lineWidth + GraphicStyle.defaultLineWidthPaddingForBackground);
    builder.setSymbology(color, color, lineWidth);
  }

  public applyStyle(builder: GraphicBuilder): void {
    builder.setSymbology(this.lineColorDef, this.fillColorDef, this.lineWidth, this.linePixels);
  }

  public clone(): GraphicStyle {
    return new GraphicStyle(this);
  }
}

export class StyleSet {
  private static _styleSets = new Map<string, StyleSet>();

  private _name: string;
  private _graphicStyles: Map<string, GraphicStyle>;
  private _textStyles: Map<string, TextStyleProps>;
  private _fallbackStyleSetName?: string;
  private _fallbackStyleSet?: StyleSet;

  /** Gets or sets the styleset's name */
  public get name(): string {
    return this._name;
  }

  public set name(name: string) {
    this._name = name;
  }

  /** Gets or sets the optional fallback styleset */
  public get fallbackStyleSetName(): string | undefined {
    return this._fallbackStyleSetName;
  }

  public set fallbackStyleSetName(value: string | undefined) {
    this._fallbackStyleSet = undefined;
    this._fallbackStyleSetName = value;
  }

  /** Gets the fallback styleset instance, if it exists. */
  public get fallbackStyleSet(): StyleSet | undefined {
    // If no name, there is no style to look up...the fallback needs to be explicitly set
    if (!this._fallbackStyleSetName)
      return undefined;

    // Return cached or look up from map
    if (this._fallbackStyleSet)
      return this._fallbackStyleSet;

    // Cache and return
    this._fallbackStyleSet = StyleSet.getOrDefault(this._fallbackStyleSetName);
    return this._fallbackStyleSet;
  }

  constructor(name: string) {
    this._name = name;
    this._graphicStyles = new Map<string, GraphicStyle>();
    this._textStyles = new Map<string, TextStyleProps>();
  }

  public getGraphicStyle(name: string): GraphicStyle | undefined {
    const style = this._graphicStyles.get(name);
    if (style)
      return style;

    if (this.fallbackStyleSet)
      return this.fallbackStyleSet.getGraphicStyle(name);

    return undefined;
  }

  public setGraphicStyle(name: string, styleProps: GraphicStyleProps): void {
    if (styleProps instanceof GraphicStyle)
      this._graphicStyles.set(name, styleProps);
    else
      this._graphicStyles.set(name, new GraphicStyle(styleProps));
  }

  public getTextStyle(name: string): TextStyleProps | undefined {
    const style = this._textStyles.get(name);
    if (style)
      return style;

    if (this.fallbackStyleSet)
      return this.fallbackStyleSet.getTextStyle(name);

    return undefined;
  }

  public setTextStyle(name: string, style: TextStyleProps): void {
    this._textStyles.set(name, style);
  }

  public clone(newName?: string): StyleSet {
    const copy = new StyleSet((newName) ? newName : this._name);

    for (const kv of this._graphicStyles)
      copy._graphicStyles.set(kv[0], kv[1].clone());

    for (const kv of this._textStyles)
      copy._textStyles.set(kv[0], { ...kv[1] });

    copy.fallbackStyleSetName = this.fallbackStyleSetName;

    return copy;
  }

  /** Returns the default StyleSet */
  public static get default(): StyleSet {
    return this._styleSets.get("default")!;
  }

  /** Returns the default "locked" StyleSet for inactive/frozen elements that cannot be moved or manipulated. */
  public static get defaultLocked(): StyleSet {
    return this._styleSets.get("default-locked")!;
  }

  /** Returns the StyleSet matching the name, or undefined. */
  public static get(name: string): StyleSet | undefined {
    return this._styleSets.get(name);
  }

  /** Returns the StyleSet maching the name or the 'default' set. */
  public static getOrDefault(name: string): StyleSet {
    return this._styleSets.get(name) || StyleSet.default;
  }

  /** Adds a StyleSet. */
  public static set(styleSet: StyleSet): void {
    this._styleSets.set(styleSet.name, styleSet);
  }
}

/** Sets the alpha. 0 is fully transparent and 255 is fully opaque. */
function setAlphaToJson(c: ColorDefProps, alpha: number): ColorDefProps {
  return ColorDef.fromTbgr(c).withAlpha(alpha).toJSON();
}
/** Adds all the default values for the GraphicalStyle/TextStyle types. */
function createStyleSets(): void {
  const s = new StyleSet("default");
  StyleSet.set(s);

  const MEASURE_ALPHA = 255;
  const BOX_CORNER_RADIUS = 5.0;

  // MeasureArea tool
  s.setGraphicStyle(WellKnownGraphicStyleType.AreaMeasurement, {
    lineColor: ColorByName.white,
    fillColor: setAlphaToJson(ColorByName.white, 128),
    lineWidth: 3,
  });
  s.setGraphicStyle(WellKnownGraphicStyleType.AreaMeasurementDynamic, {
    lineColor: ColorByName.gray,
    fillColor: setAlphaToJson(ColorByName.gray, 128),
    lineWidth: 3,
  });
  s.setTextStyle(WellKnownTextStyleType.AreaMeasurement, {
    textFont: "14px sans-serif",
    textColor: ColorByName.black,
    boxPadding: 6,
    boxCornerRadius: BOX_CORNER_RADIUS,
    boxColor: setAlphaToJson(ColorByName.white, MEASURE_ALPHA),
  });

  // MeasureDistance tool
  s.setGraphicStyle(WellKnownGraphicStyleType.DistanceMeasurement, {
    lineColor: setAlphaToJson(ColorByName.white, MEASURE_ALPHA),
    fillColor: setAlphaToJson(ColorByName.white, MEASURE_ALPHA),
    lineWidth: 3,
  });
  s.setTextStyle(WellKnownTextStyleType.DistanceMeasurement, {
    textFont: "14px sans-serif",
    textColor: ColorByName.black,
    boxPadding: 6,
    boxCornerRadius: BOX_CORNER_RADIUS,
    boxColor: setAlphaToJson(ColorByName.white, MEASURE_ALPHA),
    boxBorderWidth: 1.0,
  });
  s.setGraphicStyle(WellKnownGraphicStyleType.Rise, {
    lineColor: ColorByName.lightGray,
    fillColor: ColorByName.lightGray,
    lineWidth: 2,
  });
  s.setTextStyle(WellKnownTextStyleType.Rise, {
    textFont: "14px sans-serif",
    textColor: ColorByName.black,
    boxPadding: 6,
    boxCornerRadius: BOX_CORNER_RADIUS,
    boxColor: ColorByName.lightGray,
  });
  s.setGraphicStyle(WellKnownGraphicStyleType.Run, {
    lineColor: ColorByName.lightGray,
    fillColor: ColorByName.lightGray,
    lineWidth: 2,
  });
  s.setTextStyle(WellKnownTextStyleType.Run, {
    textFont: "14px sans-serif",
    textColor: ColorByName.black,
    boxPadding: 6,
    boxCornerRadius: BOX_CORNER_RADIUS,
    boxColor: ColorByName.lightGray,
  });

  // MeasureLocation tool
  s.setGraphicStyle(WellKnownGraphicStyleType.LocationMeasurement, {
    lineColor: setAlphaToJson(ColorByName.white, MEASURE_ALPHA),
    fillColor: setAlphaToJson(ColorByName.white, MEASURE_ALPHA),
    lineWidth: 9,
  });
  s.setTextStyle(WellKnownTextStyleType.LocationMeasurement, {
    textFont: "14px sans-serif",
    textLineHeight: 1.4,
    textColor: ColorByName.black,
    boxPadding: 6,
    boxCornerRadius: BOX_CORNER_RADIUS,
    boxColor: setAlphaToJson(ColorByName.white, MEASURE_ALPHA),
    boxBorderWidth: 1.0,
  });

  s.setTextStyle(WellKnownTextStyleType.HoverBox, {
    textFont: "14px sans-serif",
    textColor: ColorByName.black,
    boxPadding: 8,
    boxColor: ColorByName.white,
    boxBorderWidth: 2,
    boxCornerRadius: BOX_CORNER_RADIUS,
    textLineHeight: 1.4,
  });

  // Debatable if we should clone or set the fallback. I feel like default styles should be fully populated

  const lockIconStyle = { iconSpec: "icon-lock", position: IconAlignment.Bottom, offset: { x: 0, y: 16 }, padding: 5, bgColor: setAlphaToJson(ColorByName.lightGrey, MEASURE_ALPHA), bgCornerRadius: 16, borderWidth: 1 };

  // Locked distance
  const defaultLocked = s.clone("default-locked");
  defaultLocked.fallbackStyleSetName = s.name;
  const lockedDistanceStyle = defaultLocked.getGraphicStyle(WellKnownGraphicStyleType.DistanceMeasurement);
  lockedDistanceStyle!.lineColor = setAlphaToJson(ColorByName.slateGrey, MEASURE_ALPHA);
  lockedDistanceStyle!.fillColor = setAlphaToJson(ColorByName.slateGrey, MEASURE_ALPHA);

  const lockedDistanceTextStyle = defaultLocked.getTextStyle(WellKnownTextStyleType.DistanceMeasurement);
  lockedDistanceTextStyle!.boxColor = setAlphaToJson(ColorByName.lightGrey, MEASURE_ALPHA);
  lockedDistanceTextStyle!.icon = lockIconStyle;

  // Locked area
  const lockedAreaStyle = defaultLocked.getGraphicStyle(WellKnownGraphicStyleType.AreaMeasurement);
  lockedAreaStyle!.lineColor = ColorByName.slateGrey;
  lockedAreaStyle!.fillColor = setAlphaToJson(ColorByName.slateGrey, 128);

  const lockedAreaTextStyle = defaultLocked.getTextStyle(WellKnownTextStyleType.AreaMeasurement);
  lockedAreaTextStyle!.boxColor = setAlphaToJson(ColorByName.lightGrey, MEASURE_ALPHA);
  lockedAreaTextStyle!.icon = lockIconStyle;

  // Locked location
  const lockedLocationStyle = defaultLocked.getGraphicStyle(WellKnownGraphicStyleType.LocationMeasurement);
  lockedLocationStyle!.lineColor = setAlphaToJson(ColorByName.slateGrey, MEASURE_ALPHA);
  lockedLocationStyle!.fillColor = setAlphaToJson(ColorByName.slateGrey, MEASURE_ALPHA);

  const lockedLocationTextStyle = defaultLocked.getTextStyle(WellKnownTextStyleType.LocationMeasurement);
  lockedLocationTextStyle!.boxColor = setAlphaToJson(ColorByName.lightGrey, MEASURE_ALPHA);
  lockedLocationTextStyle!.icon = lockIconStyle;

  // Locked hover box
  const lockedHoverBoxStyle = defaultLocked.getTextStyle(WellKnownTextStyleType.HoverBox)!;
  lockedHoverBoxStyle.boxColor = setAlphaToJson(ColorByName.lightGrey, MEASURE_ALPHA);
  lockedHoverBoxStyle.icon = lockIconStyle;

  StyleSet.set(defaultLocked);

  // Faded (ghosted) style
  const FADED_ALPHA = 64;

  const faded = s.clone("faded");
  faded.fallbackStyleSetName = s.name;

  // Faded distance
  const fadedDistanceStyle = faded.getGraphicStyle(WellKnownGraphicStyleType.DistanceMeasurement);
  fadedDistanceStyle!.lineColor = setAlphaToJson(ColorByName.lightGrey, FADED_ALPHA);
  fadedDistanceStyle!.fillColor = setAlphaToJson(ColorByName.lightGrey, FADED_ALPHA);
  fadedDistanceStyle!.backgroundColor = setAlphaToJson(ColorByName.lightGrey, FADED_ALPHA);

  const fadedDistanceTextStyle = faded.getTextStyle(WellKnownTextStyleType.DistanceMeasurement);
  fadedDistanceTextStyle!.boxColor = setAlphaToJson(ColorByName.lightGrey, FADED_ALPHA * 2);
  fadedDistanceTextStyle!.boxBorderWidth = undefined;

  // Faded area
  const fadedAreaStyle = faded.getGraphicStyle(WellKnownGraphicStyleType.AreaMeasurement);
  fadedAreaStyle!.lineColor = setAlphaToJson(ColorByName.lightGrey, FADED_ALPHA);
  fadedAreaStyle!.fillColor = setAlphaToJson(ColorByName.lightGrey, FADED_ALPHA);
  fadedAreaStyle!.backgroundColor = setAlphaToJson(ColorByName.lightGrey, FADED_ALPHA);

  const fadedAreaTextStyle = faded.getTextStyle(WellKnownTextStyleType.AreaMeasurement);
  fadedAreaTextStyle!.boxColor = setAlphaToJson(ColorByName.lightGrey, FADED_ALPHA * 2);
  fadedAreaTextStyle!.boxBorderWidth = undefined;

  // Faded location
  const fadedLocationStyle = faded.getGraphicStyle(WellKnownGraphicStyleType.LocationMeasurement);
  fadedLocationStyle!.lineColor = setAlphaToJson(ColorByName.lightGrey, FADED_ALPHA);
  fadedLocationStyle!.fillColor = setAlphaToJson(ColorByName.lightGrey, FADED_ALPHA);
  fadedLocationStyle!.backgroundColor = setAlphaToJson(ColorByName.lightGrey, FADED_ALPHA);

  const fadedLocationTextStyle = faded.getTextStyle(WellKnownTextStyleType.LocationMeasurement);
  fadedLocationTextStyle!.boxColor = setAlphaToJson(ColorByName.lightGrey, FADED_ALPHA * 2);
  fadedLocationTextStyle!.boxBorderWidth = undefined;

  // Faded hover box
  const fadedHoverBoxStyle = faded.getTextStyle(WellKnownTextStyleType.HoverBox);
  fadedHoverBoxStyle!.boxColor = setAlphaToJson(ColorByName.lightGrey, FADED_ALPHA * 2);
  fadedHoverBoxStyle!.boxBorderWidth = undefined;

  StyleSet.set(faded);
}

// Populate default styles
createStyleSets();
