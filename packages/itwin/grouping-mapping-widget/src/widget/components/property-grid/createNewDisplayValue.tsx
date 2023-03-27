/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import type { PropertyRecord } from "@itwin/appui-abstract";
import type { HighlightingComponentProps, PropertyValueRendererContext } from "@itwin/components-react";
import { HighlightedText, PropertyContainerType, PropertyValueRendererManager } from "@itwin/components-react";
import { CommonPropertyRenderer } from "@itwin/components-react/lib/cjs/components-react/properties/renderers/CommonPropertyRenderer";
import { Orientation } from "@itwin/core-react";
import * as React from "react";
import { countMatchesInString } from "./countMatchesInString";

function createHighlightCallback(highlight: HighlightingComponentProps & { applyOnLabel: boolean }, propertyRecord: PropertyRecord) {
  const activeMatch = highlight.activeHighlight;
  const propertyName = activeMatch?.highlightedItemIdentifier;
  const matchIndex = activeMatch?.highlightIndex ?? 0;
  let labelMatches: number;

  if (highlight.applyOnLabel) {
    labelMatches = countMatchesInString(propertyRecord.property.displayLabel.toLowerCase(), highlight.highlightedText);
  } else {
    labelMatches = 0;
  }

  const activeMatchIndex = (propertyRecord.property.name === propertyName) && ((matchIndex - labelMatches) >= 0) ? (matchIndex - labelMatches) : undefined;
  const highlightCallback = (text: string) => (<HighlightedText text={text} activeMatchIndex={activeMatchIndex} searchText={highlight.highlightedText} />);

  return highlightCallback;
}

export function createNewDisplayValue(
  orientation: Orientation,
  propertyRecord: PropertyRecord,
  indentation?: number,
  propertyValueRendererManager?: PropertyValueRendererManager,
  isExpanded?: boolean,
  onExpansionToggled?: () => void,
  onHeightChanged?: (newHeight: number) => void,
  highlight?: HighlightingComponentProps & { applyOnLabel: boolean, applyOnValue: boolean }
) {
  const highlightCallback = highlight?.applyOnValue ? (createHighlightCallback(highlight, propertyRecord)) : undefined;
  const rendererContext: PropertyValueRendererContext = {
    orientation,
    containerType: PropertyContainerType.PropertyPane,
    isExpanded,
    onExpansionToggled,
    onHeightChanged,
    textHighlighter: highlightCallback,
  };

  let displayValue: React.ReactNode | undefined;
  if (propertyValueRendererManager)
    displayValue = propertyValueRendererManager.render(propertyRecord, rendererContext);
  else
    displayValue = PropertyValueRendererManager.defaultManager.render(propertyRecord, rendererContext);

  // Align value with label if orientation is vertical
  if (orientation === Orientation.Vertical)
    displayValue = <span style={{ paddingLeft: CommonPropertyRenderer.getLabelOffset(indentation, orientation) }}>{displayValue}</span>;

  return displayValue;
}
