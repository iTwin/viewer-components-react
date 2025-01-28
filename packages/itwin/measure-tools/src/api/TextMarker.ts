/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import type { Id64String } from "@itwin/core-bentley";
import type { Vector3d, XAndY, XYAndZ } from "@itwin/core-geometry";
import { Angle, AxisIndex, LineString3d, Matrix3d, Point2d, Point3d, PolygonOps, Transform } from "@itwin/core-geometry";
import { ColorDef, Hilite } from "@itwin/core-common";
import type { BeButtonEvent, CanvasDecoration, DecorateContext, Viewport } from "@itwin/core-frontend";
import {
  BeButton, IModelApp, SelectionMode, SelectionTool,
} from "@itwin/core-frontend";
import type { IconStyleProps, TextOffsetProps, TextStyleProps } from "./GraphicStyle.js";
import { IconAlignment, StyleSet, TextOffsetType, WellKnownTextStyleType } from "./GraphicStyle.js";

/**
 * TextEntry for the TextMarker
 * Title is in bold and the text is on the right with no style modifier
 */
export interface TextEntry {
  label: string;
  value: string;
}

/** Optional hilite properties that can be attached to a TextMarker and apply different styling. */
export interface TextHiliteProps {
  /** Is this control hilited or not. */
  isHilited: boolean;
  /** Optional scale factor applied when hiliting. */
  scaleFactor?: number;
  /** Optional hilite color. */
  color?: string;
}

enum Visibility {
  /** TextMarker is always visible. */
  Visible,
  /** TextMarker is visible unless it's wider than maxWorldWidth. */
  CollapseOversized,
  /** TextMarker is not displayed. */
  Hidden,
}

/**
 * A TextMarker is used to display text that follows a fixed location in world space.
 * @beta
 */
export class TextMarker implements CanvasDecoration {
  /** Expose the visibility enum. */
  public static readonly Visibility = Visibility;

  private static readonly _titleTextSpacing = 5;
  /** Text lines to be displayed. */
  public textLines: string[] | TextEntry[];
  /** The font for the text. See https://developer.mozilla.org/en-US/docs/Web/API/CanvasRenderingContext2D/font. */
  public textFont: string = "14px sans-serif";
  /** Height of a text line, in percentage. Behaves like CSS's line-height property. */
  public textLineHeight = 1.2;
  /** Fill style for text. See the `textColor` setter. */
  private _textFillStyle: string = "rgb(0,0,0)";
  private _textFillAlpha: number = 1.0;
  /** Unit text direction. Used to calculate the angle of the text. If undefined, text is billboarded to always face the camera. */
  public textDirection?: Vector3d;
  private _textAngle: Angle = Angle.zero();

  /** Location of the center of the text in world coordinates */
  public worldLocation: Point3d;
  private _viewPosition = new Point3d();
  /** Offset from the center of the text in view coordinates (in pixels or percentage of text size). */
  public offset?: TextOffsetProps;

  /** Padding around the text, in pixels. */
  public boxPadding = 0;
  /** When radius is positive, creates rounded corners. */
  public boxCornerRadius = 0.0;
  /** Width of the black border around the box, in pixels. NOTE: only displayed if the box is visible. */
  public boxBorderWidth = 0;
  private _boxBorderColor?: string;
  /** Size of the box in pixels. Set by the last successful call to drawDecoration. */
  private _boxSize = Point2d.createZero();
  public get boxSize(): Point2d { return this._boxSize; }

  /** Fill style for background box. See the `boxColor` setter. When no fill style is provided, the box isn't displayed. */
  private _boxFillColor?: ColorDef;
  private _boxFillStyle?: string;
  private _boxFillAlpha: number = 1.0;
  /** Outline of the box. Used for picking. */
  private _boxOutline?: Point3d[];

  /** If text marker was styled from a graphical style that specifie an icon, it will create an element to position during render. */
  private _iconHtmlElement?: HTMLElement;
  private _iconPosition: IconAlignment = IconAlignment.Center;
  private _iconOffset: Point2d = Point2d.createZero();
  private _currViewport?: Viewport;
  private _currPixelSize: number = 0;
  private _flashViewports = new Set<Viewport>();

  public hiliteProps?: TextHiliteProps;
  /** Whether this marker can be picked/consume mouse events. False by default. */
  public pickable: boolean = false;

  /** Transient ID if the text marker should behave like other decoration graphics that can be hilited/flashed. If valid and pickable set to true:
   * 1. Will flash when hovered over.
   * 2. When mouse button is pressed, it will add/remove the ID to the viewport's imodel selection set based
   * on the current select tool's selection mode.
   *
   * This is separate from the other hilite options and is meant to conform to any pickable graphics the text marker may be associated with. Do not combine
   * both techniques, this will override the other.
   */
  public transientHiliteId?: Id64String;

  /** See `setMouseButtonHandler` */
  private _onMouseButtonHandler?: (ev: BeButtonEvent) => boolean;
  /** See `setMouseEnterHandler` */
  private _onMouseEnterHandler?: (ev: BeButtonEvent) => void;
  /** See `setMouseLeaveHandler` */
  private _onMouseLeaveHandler?: () => void;

  /** Whether this marker is visible. Visible by default. */
  public visibility = Visibility.Visible;
  /** See `Visibility.CollapseOversized` */
  public maxWorldWidth = 0.0;

  /** Constructor */
  constructor(textLines: string[] | TextEntry[], worldLocation: XYAndZ, textDirection?: Vector3d) {
    this.textLines = textLines;
    this.worldLocation = Point3d.createFrom(worldLocation);
    this.textDirection = textDirection;
  }

  public static createStyled(textLines: string[] | TextEntry[], worldLocation: XYAndZ, style: TextStyleProps, textDirection?: Vector3d): TextMarker {
    const marker = new TextMarker(textLines, worldLocation, textDirection);
    marker.applyStyle(style);
    return marker;
  }

  /** Creates a TextMarker with the appropriate styling and offset parameters for a Hover box. */
  public static createHoverBox(textLines: string[] | TextEntry[], worldLocation: XYAndZ, styleSet?: StyleSet): TextMarker {
    const marker = new TextMarker(textLines, worldLocation);
    const styleTheme = styleSet || StyleSet.default;
    const style = styleTheme.getTextStyle(WellKnownTextStyleType.HoverBox);
    marker.applyStyle(style);
    marker.offset = { x: 0.0, y: -0.8, type: TextOffsetType.Percentage };
    return marker;
  }

  public applyStyle(style?: TextStyleProps) {
    // If undefined, apply defaults
    if (!style)
      style = { textFont: "14px sans-serif" };

    this.textFont = (style.textFont !== undefined) ? style.textFont : "14px sans-serif";
    this.textLineHeight = (style.textLineHeight !== undefined) ? style.textLineHeight : 1.2;
    this.textColor = (style.textColor !== undefined) ? ColorDef.fromTbgr(style.textColor) : ColorDef.create("rgba(0, 0, 0, 1)");
    this.boxPadding = (style.boxPadding !== undefined) ? style.boxPadding : 0;
    this.boxCornerRadius = (style.boxCornerRadius !== undefined) ? style.boxCornerRadius : 0;
    this.boxBorderWidth = (style.boxBorderWidth !== undefined) ? style.boxBorderWidth : 0;
    this._boxBorderColor = (style.boxBorderColor !== undefined) ? ColorDef.fromTbgr(style.boxBorderColor).toHexString() : undefined;
    this.boxColor = (style.boxColor !== undefined) ? ColorDef.fromTbgr(style.boxColor) : undefined;

    this.createIcon(style.icon);
  }

  private createIcon(style?: IconStyleProps) {
    if (!style) {
      this._iconHtmlElement = undefined;
      this._iconPosition = IconAlignment.Center;
      this._iconOffset.setZero();
      return;
    }

    // eslint-disable-next-line deprecation/deprecation
    const elem = document.createElement("i");
    elem.className = `icon ${style.iconSpec}`;

    this._iconPosition = (style.position !== undefined) ? style.position : IconAlignment.Center;

    if (style.offset)
      this._iconOffset.setFromJSON(style.offset);
    else
      this._iconOffset.setZero();

    this._iconHtmlElement = elem;

    if (style.size !== undefined)
      elem.style.fontSize = `${style.size.toString()}px`;

    if (style.iconColor !== undefined)
      elem.style.color = ColorDef.fromTbgr(style.iconColor).toHexString();

    if (style.padding !== undefined)
      elem.style.padding = `${style.padding.toString()}px`;

    if (style.bgColor !== undefined) {
      elem.style.backgroundColor = ColorDef.fromTbgr(style.bgColor).toHexString();

      if (style.bgCornerRadius !== undefined)
        elem.style.borderRadius = `${style.bgCornerRadius.toString()}px`;
    }

    if (style.borderWidth !== undefined) {
      elem.style.borderWidth = `${style.borderWidth.toString()}px`;
      elem.style.borderStyle = "solid";

      if (style.borderColor !== undefined)
        elem.style.borderColor = ColorDef.fromTbgr(style.borderColor).toHexString();
    }
  }

  private positionIconHtml() {
    if (this._iconHtmlElement === undefined)
      return;

    const html = this._iconHtmlElement;
    const style = html.style;
    style.position = "absolute";
    const size = html.getBoundingClientRect(); // Note: only call this *after* setting position = absolute
    const markerPos = this.position;
    style.left = `${markerPos.x - (size.width / 2)}px`;
    style.top = `${markerPos.y - (size.height / 2)}px`;
  }

  private moveIconHtml(boxWidth: number, boxHeight: number) {
    // The idea is if the position of the icon is not at the center, then come up with a position somewhere
    // on the outer edge of the box
    if (this._iconPosition === IconAlignment.Center || this._iconHtmlElement === undefined)
      return;

    const xOffset = this.getXOffsetFromCenterInPixels(boxWidth);
    const yOffset = this.getYOffsetFromCenterInPixels(boxHeight);

    if (this.hiliteProps && this.hiliteProps.isHilited && undefined !== this.hiliteProps.scaleFactor) {
      boxWidth = this.hiliteProps.scaleFactor * boxWidth;
      boxHeight = this.hiliteProps.scaleFactor * boxHeight;
    }

    let x, y;

    switch (this._iconPosition) {
      case IconAlignment.TopLeft:
        x = -0.5 * boxWidth + xOffset;
        y = -0.5 * boxHeight + yOffset;
        break;
      case IconAlignment.Top:
        x = xOffset;
        y = -0.5 * boxHeight + yOffset;
        break;
      case IconAlignment.TopRight:
        x = 0.5 * boxWidth + xOffset;
        y = -0.5 * boxHeight + yOffset;
        break;
      case IconAlignment.Left:
        x = -0.5 * boxWidth + xOffset;
        y = yOffset;
        break;
      case IconAlignment.Right:
        x = 0.5 * boxWidth + xOffset;
        y = yOffset;
        break;
      case IconAlignment.BottomLeft:
        x = -0.5 * boxWidth + xOffset;
        y = 0.5 * boxHeight + yOffset;
        break;
      case IconAlignment.Bottom:
        x = xOffset;
        y = 0.5 * boxHeight + yOffset;
        break;
      case IconAlignment.BottomRight:
        x = 0.5 * boxWidth + xOffset;
        y = 0.5 * boxHeight + yOffset;
        break;
      default:
        return; // Should not hit, effectively center
    }

    // Apply offset
    x += this._iconOffset.x;
    y += this._iconOffset.y;

    // Apply marker position
    const markerPos = this.position;
    x += markerPos.x;
    y += markerPos.y;

    /// Note: only call this *after* setting position = absolute
    const size = this._iconHtmlElement.getBoundingClientRect();

    this._iconHtmlElement.style.left = `${x - (size.width / 2)}px`;
    this._iconHtmlElement.style.top = `${y - (size.height / 2)}px`;
  }

  /**
   * Assigns a handler to the onMouseButton event.
   * NOTE: called two times per click event (down/up). Handle appropriately.
   */
  public setMouseButtonHandler(handler?: (ev: BeButtonEvent) => boolean): void {
    this._onMouseButtonHandler = handler;
  }
  /** Assigns a handler to the onMouseEnter event. */
  public setMouseEnterHandler(handler?: (ev: BeButtonEvent) => void): void {
    this._onMouseEnterHandler = handler;
  }
  /** Assigns a handler to the onMouseLeave event. */
  public setMouseLeaveHandler(handler?: () => void): void {
    this._onMouseLeaveHandler = handler;
  }

  private setPosition(vp: Viewport): boolean {
    if (Visibility.Hidden === this.visibility)
      return false;

    this._viewPosition = vp.worldToView(this.worldLocation, this._viewPosition);
    if (!vp.viewRect.containsPoint(this._viewPosition))
      return false;

    this._currPixelSize = vp.getPixelSizeAtPoint();
    if (this.isCollapsed())
      return false;

    this._textAngle.setRadians(this.calculateAngle(vp));
    return true;
  }

  private isCollapsed(): boolean {
    if (Visibility.CollapseOversized !== this.visibility)
      return false;

    // Don't collapse if we never had a draw call.
    const boxMax = Math.max(this._boxSize.x, this._boxSize.y);
    if (boxMax <= 0)
      return false;

    const worldWidth = boxMax * this._currPixelSize;
    if (worldWidth < this.maxWorldWidth)
      return false;

    return true;
  }

  private calculateAngle(vp: Viewport): number {
    if (undefined === this.textDirection)
      return 0.0;
    const x = vp.view.getXVector().dotProduct(this.textDirection);
    const y = vp.view.getYVector().dotProduct(this.textDirection);
    return Math.atan(y / x);
  }

  /** Adds this decoration to the supplied DecorateContext. */
  public addDecoration(context: DecorateContext): void {
    if (this.setPosition(context.viewport)) {
      this._currViewport = context.viewport;
      context.addCanvasDecoration(this);

      // Add icon if any, and position it relative to the canvas decoration
      if (this._iconHtmlElement !== undefined) {
        context.addHtmlDecoration(this._iconHtmlElement);
        this.positionIconHtml();
      }
    }
  }

  /** Returns (a reference to) the current position of the decoration in view coordinates (pixels).
   * It's the result of worldToView of the wordLocation and does not account for offset.
   */
  public get position(): XAndY { return this._viewPosition; }
  /** Returns the central position of the TextMarker in view coordinates, including computed offset. */
  public get computedPosition(): Point2d {
    const coords = Point2d.createFrom(this._viewPosition);
    coords.x += this.getXOffsetFromCenterInPixels(this._boxSize.x);
    coords.y += this.getYOffsetFromCenterInPixels(this._boxSize.y);
    return coords;
  }

  /** Sets the `textFillStyle` attribute based on a ColorDef's RGBA. */
  public set textColor(v: ColorDef) {
    this._textFillStyle = v.toHexString();
    this._textFillAlpha = v.getAlpha() / 255.0;
  }

  /** Sets the `backgroundFillStyle` attribute based on a ColorDef's RGBA. */
  public set boxColor(v: ColorDef | undefined) {
    this._boxFillColor = undefined === v ? undefined : v;
    this._boxFillStyle = undefined === v ? undefined : v.toHexString();
    this._boxFillAlpha = undefined === v ? 1.0 : v.getAlpha() / 255.0;
  }

  private isStringArray(value: string[] | TextEntry[]): value is string[] {
    if (0 === value.length)
      return true;
    return (typeof value[0] === "string" || value[0] instanceof String);
  }

  /** Creates the closed polygon for picking. */
  private updateBoxOutline(boxWidth: number, boxHeight: number): void {
    this._boxOutline = undefined;
    if (!this.pickable)
      return;

    const xOffset = this.getXOffsetFromCenterInPixels(boxWidth);
    const yOffset = this.getYOffsetFromCenterInPixels(boxHeight);

    if (this.hiliteProps && this.hiliteProps.isHilited && undefined !== this.hiliteProps.scaleFactor) {
      boxWidth = this.hiliteProps.scaleFactor * boxWidth;
      boxHeight = this.hiliteProps.scaleFactor * boxHeight;
    }
    const topLeftCorner = Point3d.create(-0.5 * boxWidth + xOffset, -0.5 * boxHeight + yOffset, 0.0);
    const outline = LineString3d.createRectangleXY(topLeftCorner, boxWidth, boxHeight, true);

    if (!this._textAngle.isAlmostZero) {
      const rotation = Transform.createRefs(Point3d.createZero(), Matrix3d.createRotationAroundAxisIndex(AxisIndex.Z, this._textAngle.cloneScaled(-1.0)));
      if (!outline.tryTransformInPlace(rotation))
        return;
    }
    if (!outline.tryTranslateInPlace(this._viewPosition.x, this._viewPosition.y))
      return;
    this._boxOutline = outline.points;
  }

  public drawDecoration(ctx: CanvasRenderingContext2D): void {
    if (0 === this.textLines.length)
      return;

    ctx.font = this.textFont;
    ctx.textBaseline = "top";
    // Make sure to get measurements before any scaling is applied
    const boxWidth = this.getBoxWidth(ctx);
    const boxHeight = this.getBoxHeight(ctx);
    const lineHeight = this.getLineHeight(ctx);
    this._boxSize.set(boxWidth, boxHeight);
    if (this.isCollapsed())
      return;

    // Rotation angle must be CW and in radians
    if (!this._textAngle.isAlmostZero)
      ctx.rotate(-this._textAngle.radians);

    // Translate the canvas origin so that (0,0) is at the center of the text
    const dx = -0.5 * boxWidth;
    const dy = -0.5 * boxHeight;
    ctx.translate(this.getXOffsetFromCenterInPixels(boxWidth), this.getYOffsetFromCenterInPixels(boxHeight));

    if (this.hiliteProps && this.hiliteProps.isHilited) {
      if (this.hiliteProps.color) {
        ctx.shadowBlur = 30;
        ctx.shadowColor = this.hiliteProps.color;
      }
      if (this.hiliteProps.scaleFactor)
        ctx.scale(this.hiliteProps.scaleFactor, this.hiliteProps.scaleFactor);
    }

    const radius = Math.max(0, this.boxCornerRadius);
    if (undefined !== this._boxFillStyle) {
      const bbw = Math.max(0, this.boxBorderWidth);
      ctx.globalAlpha = this._boxFillAlpha;

      if (this.pickable && this.transientHiliteId && this._currViewport) {
        let fillColorStyle = this._boxFillStyle;
        let shadowColorStyle = this._boxFillStyle;
        let shadowBlur = 0;

        // If ID is being flashed, draw with the original fill color lerped with the hilite color based on current flash intensity
        if (this._currViewport.lastFlashedElementId === this.transientHiliteId) {
          const startColor = this._boxFillColor ?? this._currViewport.hilite.color;
          fillColorStyle = startColor.lerp(this._currViewport.hilite.color, this._currViewport.flashSettings.maxIntensity).toHexString();
          shadowColorStyle = fillColorStyle;
          shadowBlur = (this._currViewport.hilite.silhouette === Hilite.Silhouette.Thick) ? 2 : 1;
          // If ID is selected, draw with hilite color silhoutte and blended fill hilite based on visible ratio.
        } else if (this._currViewport.iModel.selectionSet.has(this.transientHiliteId)) {
          const startColor = this._boxFillColor ?? this._currViewport.hilite.color;
          fillColorStyle = startColor.lerp(this._currViewport.hilite.color, this._currViewport.hilite.visibleRatio).toHexString();
          shadowColorStyle = this._currViewport.hilite.color.toHexString();
          shadowBlur = (this._currViewport.hilite.silhouette === Hilite.Silhouette.Thick) ? 2 : 1;
        }

        ctx.shadowBlur = shadowBlur;
        ctx.shadowColor = shadowColorStyle;
        ctx.fillStyle = fillColorStyle;
      } else {
        ctx.fillStyle = this._boxFillStyle;
      }

      this.drawRect(ctx, dx - bbw, dy - bbw, boxWidth + 2 * bbw, boxHeight + 2 * bbw, radius);
      ctx.fill();

      if (0 < bbw) {
        ctx.lineWidth = bbw;
        ctx.strokeStyle = (this._boxBorderColor === undefined) ? ColorDef.black.toHexString() : this._boxBorderColor;
        ctx.stroke();
      }
    }

    ctx.globalAlpha = this._textFillAlpha;
    ctx.fillStyle = this._textFillStyle;

    if (this.isStringArray(this.textLines)) {
      this.textLines.forEach((text: string, index: number) => {
        ctx.fillText(text, dx + this.boxPadding, dy + this.boxPadding + (index * lineHeight));
      });
    } else {
      const boldFont = `bold ${this.textFont}`;
      this.textLines.forEach((entry: TextEntry, index: number) => {
        ctx.font = boldFont;
        const w = ctx.measureText(entry.label).width + TextMarker._titleTextSpacing;
        ctx.fillText(entry.label, dx + this.boxPadding, dy + this.boxPadding + (index * lineHeight));
        ctx.font = this.textFont;
        ctx.fillText(entry.value, dx + this.boxPadding + w, dy + this.boxPadding + (index * lineHeight));
      });
    }

    this.updateBoxOutline(boxWidth, boxHeight);
    this.moveIconHtml(boxWidth, boxHeight);
  }

  private drawRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
    if (w < 2 * r) r = w / 2;
    if (h < 2 * r) r = h / 2;
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  public onMouseEnter(ev: BeButtonEvent): void {
    if (this._onMouseEnterHandler)
      this._onMouseEnterHandler(ev);

    if (this.transientHiliteId && ev.viewport) {
      ev.viewport.flashedId = this.transientHiliteId;
      this._flashViewports.add(ev.viewport);
    }
  }

  public onMouseLeave(): void {
    if (this._onMouseLeaveHandler)
      this._onMouseLeaveHandler();

    this._flashViewports.forEach((vp) => vp.flashedId = undefined);
    this._flashViewports.clear();
  }

  public onMouseButton(ev: BeButtonEvent): boolean {
    // If has a transient ID, we want to participate in selection events
    this.handleTransientSelection(ev);

    if (!this._onMouseButtonHandler)
      return false;

    return this._onMouseButtonHandler(ev);
  }

  public pick(pt: XAndY): boolean {
    if (!this.pickable || undefined === this._boxOutline)
      return false;
    return -1 !== PolygonOps.classifyPointInPolygon(pt.x, pt.y, this._boxOutline);
  }

  private handleTransientSelection(ev: BeButtonEvent) {
    if (!this.pickable || !this.transientHiliteId || !ev.viewport)
      return;

    const selectionMode = this.getSelectionModeIfSelectToolIsActive();
    if (selectionMode !== undefined && !ev.isDown) {
      const selectionSet = ev.viewport.iModel.selectionSet;
      switch (selectionMode) {
        case SelectionMode.Replace:
          if (ev.isControlKey) {
            if (ev.button === BeButton.Data)
              selectionSet.invert(this.transientHiliteId);
            else if (ev.button === BeButton.Reset && selectionSet.has(this.transientHiliteId))
              selectionSet.remove(this.transientHiliteId);
          } else if (ev.button === BeButton.Data) {
            selectionSet.replace(this.transientHiliteId);
            // Noticed if we selected a single element then reset on it, it gets removed from the SS. Multiple elements do not unless if using ctrl
          } else if (ev.button === BeButton.Reset && selectionSet.size === 1 && selectionSet.has(this.transientHiliteId)) {
            selectionSet.remove(this.transientHiliteId);
          }
          break;
        case SelectionMode.Add:
          if (ev.button === BeButton.Data)
            selectionSet.add(this.transientHiliteId);
          break;
        case SelectionMode.Remove:
          if (ev.button === BeButton.Data)
            selectionSet.remove(this.transientHiliteId);
          break;
      }
    }
  }

  private getLineHeight(ctx: CanvasRenderingContext2D): number {
    return this.textLineHeight * ctx.measureText("M").width;
  }
  private getBoxWidth(ctx: CanvasRenderingContext2D): number {
    let widths: number[] = [];

    if (this.isStringArray(this.textLines)) {
      widths = this.textLines.map((v: string) => ctx.measureText(v).width);
    } else {
      const boldFont = `bold ${this.textFont}`;
      widths = this.textLines.map((entry: TextEntry) => {
        ctx.font = boldFont;
        const titleWidth = ctx.measureText(entry.label).width;
        ctx.font = this.textFont;
        const textWidth = ctx.measureText(entry.value).width;
        return titleWidth + textWidth + TextMarker._titleTextSpacing;
      });
      ctx.font = this.textFont;
    }
    const maxWidth = widths.reduce((max: number, v: number) => Math.max(max, v));
    return maxWidth + 2 * this.boxPadding;
  }
  private getBoxHeight(ctx: CanvasRenderingContext2D): number {
    const lineHeight = this.getLineHeight(ctx);
    // Cut off the remaining space after the last line
    const overflow = (this.textLineHeight - 1.0) * (lineHeight / this.textLineHeight);
    return lineHeight * this.textLines.length + 2 * this.boxPadding - overflow;
  }

  private getXOffsetFromCenterInPixels(paddedBoxWidth: number): number {
    if (undefined === this.offset)
      return 0.0;
    switch (this.offset.type) {
      case TextOffsetType.Percentage: return this.offset.x * paddedBoxWidth;
      case TextOffsetType.Pixels: return this.offset.x;
      default: return 0.0;
    }
  }
  private getYOffsetFromCenterInPixels(paddedBoxHeight: number): number {
    if (undefined === this.offset)
      return 0.0;
    switch (this.offset.type) {
      case TextOffsetType.Percentage: return this.offset.y * paddedBoxHeight;
      case TextOffsetType.Pixels: return this.offset.y;
      default: return 0.0;
    }
  }

  private getSelectionModeIfSelectToolIsActive(): SelectionMode | undefined {
    const tool = IModelApp.toolAdmin.currentTool;
    if (tool instanceof SelectionTool)
      return tool.selectionMode;

    return undefined;
  }
} // TextMarker
