/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { ColorDef } from "@bentley/imodeljs-common";
import { MarkupApp } from "@bentley/imodeljs-markup";
import {
  AlphaSlider,
  ColorPickerButton,
  WeightPickerButton,
} from "@bentley/ui-components";
import { Point } from "@bentley/ui-core";
import { FrontstageManager, PositionPopup } from "@bentley/ui-framework";
import React, { useEffect, useState } from "react";
import { Line, Marker, SVG } from "@svgdotjs/svg.js";

import styles from "./MarkupSettingsPanel.module.scss";
import { MarkupFrontstage } from "../../MarkupFrontstage";
import { MarkupFrontstageConstants } from "../../util/MarkupTypes";

/**
 * Markup settings panel props.
 */
interface MarkupSettingsPanelProps {
  point: Point;
}

/**
 * Markup setting properties
 */
interface MarkupSettingProps {
  [key: string]: number | string;
}

/**
 * Markup data color with fill and stroke
 */
interface MarkupDataColor {
  fill: ColorDef;
  stroke: ColorDef;
}

/**
 * Line markup with marker
 */
interface LineWithMarker {
  [type: string]: Line;
}

/**
 * SVG props including SVG type and SVG CSS
 */
enum SvgProp {
  DATA_COLOR = "data-Color",
  FILL = "fill",
  FILL_OPACITY = "fill-opacity",
  LINE = "line",
  MARKER_END = "marker-end",
  MARKER_START = "marker-start",
  OPACITY = "opacity",
  STROKE = "stroke",
  STROKE_OPACITY = "stroke-opacity",
  STROKE_WIDTH = "stroke-width",
  TEXT = "text",
}

const MarkupSettingsPanel = (props: MarkupSettingsPanelProps) => {
  const { point } = props;

  const [fillColor, setFillColor] = useState<ColorDef>(
    ColorDef.create(MarkupApp.props.active.element.fill)
  );
  const [strokeColor, setStrokeColor] = useState<ColorDef>(
    ColorDef.create(MarkupApp.props.active.element.stroke)
  );
  const [textColor, setTextColor] = useState<ColorDef>(
    ColorDef.create(MarkupApp.props.active.text.fill)
  );
  const [activeWeight, setActiveWeight] = useState<number>(
    MarkupApp.props.active.element[SvgProp.STROKE_WIDTH]
  );
  const [transparency, setTransparency] = useState<number>(
    MarkupApp.props.active.element[SvgProp.STROKE_OPACITY]
  );

  // localized tool labels.
  const fill = MarkupFrontstage.translate("markupSettings.fill");
  const stroke = MarkupFrontstage.translate("markupSettings.stroke");
  const text = MarkupFrontstage.translate("markupSettings.text");
  const width = MarkupFrontstage.translate("markupSettings.size");
  const opacity = MarkupFrontstage.translate("markupSettings.opacity");

  /**
   * Creates arrow marker, ditto from iModelJs RedlineTool
   * @param color name of the color to be used to create arrow marker
   */
  const createArrowMarker = (
    color: string,
    length: number,
    width: number,
    alphaValue: number
  ): Marker => {
    // NOTE: Flashing doesn't currently affect markers, need support for "context-stroke" and "context-fill".
    // For now encode color in name...
    // Following marker Id is okay to be same, because it is used as a symbol which can be reused, however the whole
    // function will need to be updated once SVG 2.0 is available where we don't have to struggle for markers.
    const arrowMarkerId = "ArrowMarker" + length + "x" + width + "-" + color;
    let marker = SVG("#" + arrowMarkerId) as Marker;
    if (null === marker) {
      if (MarkupApp.markup) {
        marker = MarkupApp.markup
          ?.svgMarkup!.marker(length, width)
          .id(arrowMarkerId);
        marker.polygon([0, 0, length, width * 0.5, 0, width]);
        marker.attr("orient", "auto-start-reverse");
        marker.attr("overflow", "visible"); // Don't clip the stroke that is being applied to allow the specified start/end to be used directly while hiding the arrow tail fully under the arrow head...
        marker.attr("refX", length);
        marker.css({
          stroke: color,
          fill: color,
          "stroke-opacity": alphaValue,
          "fill-opacity": alphaValue,
        });
      }
    }
    return marker;
  };

  /**
   * Changes the active SVG element's property.
   * @param propName name of the property to be changed e.g. stroke, fill etc.
   * @param value name of the value to be used to change the property.
   * @param settingLabel name of the localized setting label of the tool button.
   */
  const changeActiveElementSettings = (
    propName: string,
    value: any,
    settingLabel: string
  ) => {
    // There's always single element in the selected elements set unless it's grouped.
    const selectedElements = MarkupApp.markup?.selected?.elements
      ? Array.from(MarkupApp.markup?.selected?.elements)
      : [];
    const firstSelectedElement =
      selectedElements.length > 0 ? selectedElements[0] : undefined;
    // To avoid the confusion between fill, stroke for other element with Text fill
    const isText = firstSelectedElement?.type === SvgProp.TEXT;
    const isBoxedText =
      firstSelectedElement?.type === "g" &&
      firstSelectedElement?.node?.classList.length > 0 &&
      firstSelectedElement?.node?.classList[0] === MarkupApp.boxedTextClass;
    const lineWithMarker: LineWithMarker = {};
    if (firstSelectedElement?.type === SvgProp.LINE) {
      if (
        firstSelectedElement?.node?.attributes.getNamedItem(
          SvgProp.MARKER_START
        )
      ) {
        lineWithMarker[SvgProp.MARKER_START] = firstSelectedElement as Line;
      }
      if (
        firstSelectedElement?.node?.attributes.getNamedItem(SvgProp.MARKER_END)
      ) {
        lineWithMarker[SvgProp.MARKER_END] = firstSelectedElement as Line;
      }
    }
    const markupProp = prepareMarkupProps(
      propName,
      value,
      settingLabel,
      lineWithMarker,
      isText
    );
    if (markupProp) {
      if (isBoxedText && firstSelectedElement?.children().length === 2) {
        const gRect = firstSelectedElement?.get(0);
        const gText = firstSelectedElement?.get(1);
        if (settingLabel === text && gText) {
          gText.css(markupProp);
        } else {
          if (gRect) {
            gRect.css(markupProp);
          }
          if (gText && settingLabel === opacity) {
            gText.css(markupProp);
          }
        }
      } else {
        firstSelectedElement?.css(markupProp);
      }
    }
  };

  /**
   * Helper to change active element settings.
   * @param propName name of the property to be changed e.g. stroke, fill etc.
   * @param value name of the value to be used to change the property.
   * @param settingLabel name of the localized setting label of the tool button.
   * @param lineWithMarker name of the line with marker map for arrows and distance.
   * @param isText name of the flag whether or not the element is of type text.
   */
  const prepareMarkupProps = (
    propName: string,
    value: any,
    settingLabel: string,
    lineWithMarker: LineWithMarker,
    isText?: boolean
  ): MarkupSettingProps | undefined => {
    if (isText && !(settingLabel === text || settingLabel === opacity)) {
      return undefined;
    }
    switch (propName) {
      case SvgProp.STROKE:
        MarkupApp.props.active.element[SvgProp.STROKE] = value as string;
        break;
      case SvgProp.STROKE_WIDTH:
        MarkupApp.props.active.element[SvgProp.STROKE_WIDTH] = value as number;
        break;
      case SvgProp.FILL:
        if (settingLabel === text) {
          MarkupApp.props.active.text[SvgProp.FILL] = value as string;
        } else {
          MarkupApp.props.active.element[SvgProp.FILL] = value as string;
        }
        break;
      case SvgProp.OPACITY:
        MarkupApp.props.active.element[SvgProp.FILL_OPACITY] = value as number;
        MarkupApp.props.active.element[
          SvgProp.STROKE_OPACITY
        ] = value as number;
        break;
      default:
        break;
    }
    const markupProp: MarkupSettingProps = {};
    // opacity is changed using slider so to leave hilite, emptying for non-opacity props only.
    // In case of line, fill chagnes marker only not the line itself, stroke width changes fill color of marker as bonus
    // Hence to avoid those conflicting result, only allowing marker color to be changed via stroke as follow.
    if (
      (lineWithMarker[SvgProp.MARKER_START] ||
        lineWithMarker[SvgProp.MARKER_END]) &&
      (settingLabel === stroke || settingLabel === opacity)
    ) {
      const arrowProps = MarkupApp.props.active.arrow;
      const lineDataColor = parseDataColor(
        lineWithMarker[SvgProp.MARKER_END].attr(SvgProp.DATA_COLOR)
      );
      const strokeVal =
        settingLabel === stroke ? value : lineDataColor?.stroke.name;
      const opacityVal = settingLabel === opacity ? value : 0.75;
      const changedArrow = createArrowMarker(
        strokeVal,
        arrowProps.length,
        arrowProps.width,
        opacityVal
      );
      lineWithMarker[SvgProp.MARKER_END].marker("end", changedArrow);
      lineWithMarker[SvgProp.MARKER_START]?.marker("start", changedArrow);
      if (settingLabel === opacity) {
        markupProp[SvgProp.FILL_OPACITY] = value;
        markupProp[SvgProp.STROKE_OPACITY] = value;
        markupProp[propName] = value;
        return markupProp;
      }
    }
    if (propName === SvgProp.OPACITY) {
      markupProp[SvgProp.FILL_OPACITY] = value;
      markupProp[SvgProp.STROKE_OPACITY] = value;
    } else {
      MarkupApp.markup?.selected?.emptyAll();
      markupProp[propName] = value;
    }
    return markupProp;
  };

  /**
   * Helper to parse data color.
   * @param dataColor name of the data color string with fill and stroke
   */
  const parseDataColor = (dataColor: string): MarkupDataColor | undefined => {
    if (
      !dataColor.includes(SvgProp.FILL) &&
      !dataColor.includes(SvgProp.STROKE)
    ) {
      return undefined;
    }
    const dataColorPayload = JSON.parse(dataColor);
    return {
      fill: ColorDef.create(dataColorPayload.fill),
      stroke: ColorDef.create(dataColorPayload.stroke),
    };
  };

  useEffect(() => {
    // There's always single element in selected element unless its grouped.
    const selectedElements = MarkupApp.markup?.selected?.elements
      ? Array.from(MarkupApp.markup?.selected?.elements)
      : [];
    const firstSelectedElement =
      selectedElements?.length > 0 ? selectedElements[0] : undefined;
    if (firstSelectedElement?.inSelection) {
      // adding length check as well as classList check to confirm boxedText.
      const isBoxedTextGType =
        firstSelectedElement?.type === "g" &&
        firstSelectedElement?.node.classList.length > 0 &&
        firstSelectedElement?.node.classList[0] === MarkupApp.boxedTextClass &&
        firstSelectedElement?.children().length === 2;
      // using strokeOpacity instead of fill because line doesn't have fillOpacity.
      const alphaVal = isBoxedTextGType
        ? firstSelectedElement?.get(0)?.node?.style.strokeOpacity
        : firstSelectedElement?.type === "line" &&
          firstSelectedElement?.node.style.opacity
          ? firstSelectedElement?.node.style.opacity
          : firstSelectedElement?.node.style.strokeOpacity;
      const strokeWidth = isBoxedTextGType
        ? firstSelectedElement?.get(0)?.node?.style.strokeWidth
        : firstSelectedElement?.node.style.strokeWidth;
      // In case if opacity and stroke are not present then setting it to default 0.75 and 3 respectively.
      // Markup app has transparency setup for both fill and stroke, by default fill is 0.2 and stroke is 0.8
      // In case if user wants it to have similar effect then we'll need to have two alpha slider
      setTransparency(alphaVal ? parseFloat(alphaVal) : 0.75);
      setActiveWeight(strokeWidth ? parseInt(strokeWidth) : 3);
      const dataColorAttr = isBoxedTextGType
        ? firstSelectedElement?.get(0)?.attr()[SvgProp.DATA_COLOR]
        : firstSelectedElement?.attr(SvgProp.DATA_COLOR);
      if (dataColorAttr) {
        const dataColor = parseDataColor(dataColorAttr);
        if (dataColor) {
          if (firstSelectedElement?.type === SvgProp.TEXT) {
            setTextColor(dataColor.fill);
            // setting default fill color to blue and stroke to red other wise it gets reset to black.
            setFillColor(ColorDef.create("rgb(0, 0, 255)"));
            setStrokeColor(ColorDef.create("rgb(255, 0, 0)"));
          } else {
            setFillColor(dataColor.fill);
            setStrokeColor(dataColor.stroke);
          }
        }
      }
      if (isBoxedTextGType) {
        const textColorAttr = firstSelectedElement?.get(1)?.attr()[
          SvgProp.DATA_COLOR
        ];
        if (textColorAttr) {
          const textColor = parseDataColor(textColorAttr);
          if (textColor) {
            setTextColor(textColor.fill);
          }
        }
      }
    }
  }, [
    FrontstageManager.activeFrontstageDef?.findWidgetDef(
      MarkupFrontstageConstants.WIDGET_ID
    )?.state,
  ]);

  return (
    <div data-testid={"markup-settings-tool"}>
      <PositionPopup point={point}>
        <div className={styles.markupContainer}>
          <div
            className={styles.markupContainerSetting}
            data-testid={"stroke-color-picker-button"}
          >
            <span className={styles.toolName}>{stroke}</span>
            <ColorPickerButton
              activeColor={strokeColor}
              onColorPick={(color: ColorDef) => {
                if (color.name) {
                  changeActiveElementSettings(
                    SvgProp.STROKE,
                    color.name,
                    stroke
                  );
                }
                setStrokeColor(color);
              }}
            />
          </div>
          <div
            className={styles.markupContainerSetting}
            data-testid={"fill-color-picker-button"}
          >
            <span className={styles.toolName}>{fill}</span>
            <ColorPickerButton
              activeColor={fillColor}
              onColorPick={(color: ColorDef) => {
                if (color.name) {
                  changeActiveElementSettings(SvgProp.FILL, color.name, fill);
                }
                setFillColor(color);
              }}
            />
          </div>
          <div
            className={styles.markupContainerSetting}
            data-testid={"stroke-weight-picker-button"}
          >
            <span className={styles.toolName}>{width}</span>
            <WeightPickerButton
              activeWeight={activeWeight}
              onLineWeightPick={(weight: number) => {
                changeActiveElementSettings(
                  SvgProp.STROKE_WIDTH,
                  weight,
                  width
                );
                setActiveWeight(weight);
              }}
            />
          </div>
          <div
            className={styles.markupContainerSetting}
            data-testid={"alpha-slider"}
          >
            <span className={styles.toolName}>{opacity}</span>
            <AlphaSlider
              className={styles.markupTransparencySlider}
              alpha={transparency}
              isHorizontal={true}
              onAlphaChange={(alpha: number) => {
                changeActiveElementSettings(SvgProp.OPACITY, alpha, opacity);
                setTransparency(alpha);
              }}
            />
          </div>
          <div
            className={styles.markupContainerSetting}
            data-testid={"text-color-picker-button"}
          >
            <span className={styles.toolName}>{text}</span>
            <ColorPickerButton
              activeColor={textColor}
              onColorPick={(color: ColorDef) => {
                if (color.name) {
                  changeActiveElementSettings(SvgProp.FILL, color.name, text);
                }
                setTextColor(color);
              }}
            />
          </div>
        </div>
      </PositionPopup>
    </div>
  );
};

export default MarkupSettingsPanel;
