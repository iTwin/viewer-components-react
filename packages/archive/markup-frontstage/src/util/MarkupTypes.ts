/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { MarkupUiEvent } from "./MarkupUiEvents";
import { SavedViewData } from "./SavedViewTypes";
import { MarkupViewStateProps } from "./MarkupViewState";

/**
 * Markup frontstage constants.
 */
export enum MarkupFrontstageConstants {
  DRAWING_TOOLS = "DrawingTools",
  FRONTSTAGE_ID = "BentleyMarkupFrontstage",
  TOOL_SETTINGS_WIDGET_KEY = "MarkupToolSettingsWidget",
  TOOL_WIDGET_KEY = "MarkupToolWidget",
  VIEW_LAYOUT_ID = "MarkupView",
  WIDGET_ID = "MarkupWidget",
  WIDGET_KEY = "MarkupWidget",
}

/**
 * Mapping of view element and nine-zone layout position in the viewport
 * e.g.
 * {
      topCenter: (
        <Zone
          widgets={[
            <Widget
              key={MarkupFrontstageConstants.TOOL_SETTINGS_WIDGET_KEY}
              isToolSettings={true}
            />,
          ]}
        />
      )
    }
 */
export interface ViewElementDictionary {
  [layoutKey: string]: React.ReactElement;
}

/**
 * Status Bar items.
 */
export interface StatusBarItem {
  right: React.ReactElement;
  center: React.ReactElement;
  left: React.ReactElement;
}

/**
 * Add markup event arguments.
 */
export interface AddMarkupEventArgs {
  /**
   * @deprecated Use markupViewStateProps instead.
   */
  savedView: SavedViewData;
  thumbImage: string;
  markupViewStateProps: MarkupViewStateProps;
}

/** Add Markup Event class.
 */
export class AddMarkupEvent extends MarkupUiEvent<AddMarkupEventArgs> { }

/** Stop Markup Event class.
 */
export class StopMarkupEvent extends MarkupUiEvent<void> { }
