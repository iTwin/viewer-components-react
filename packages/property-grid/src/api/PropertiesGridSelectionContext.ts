/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { BeEvent, Id64 } from "@bentley/bentleyjs-core";
import { WidgetState } from "@bentley/ui-abstract";
import {
  FrontstageDef,
  FrontstageManager,
  WidgetDef,
} from "@bentley/ui-framework";

/** Used to control properties grid automatic opening based on selection set changes */
export class PropertiesGridSelectionContext {
  private static _priorityWidgetIds: string[];
  private static _propertyPanelId: string;
  private static _propertyWidgetLastState: WidgetState = WidgetState.Open;
  private static _selectionEvent:
    | BeEvent<(ids: Set<string>) => void>
    | undefined;
  private static _suspended = false;

  /**
   * Initialize the properties grid selection context to provide automatic opening and closing of the property panel
   * @param _selectionEvent Event to use for selection set change listening
   * @param __propertyPanelId App given Id for the property panel widget
   * @param widgetIds Ids of widgets that should take precendence and avoid the panel from opening at all if open
   */
  public static initialize(
    _selectionEvent: BeEvent<(ids: Set<string>) => void>,
    _propertyPanelId: string,
    widgetIds: string[]
  ) {
    PropertiesGridSelectionContext._priorityWidgetIds = widgetIds;
    PropertiesGridSelectionContext._propertyPanelId = _propertyPanelId;
    PropertiesGridSelectionContext._selectionEvent = _selectionEvent;
    _selectionEvent.addListener(
      PropertiesGridSelectionContext.selectionChangedHandler
    );
  }

  /**
   * Used to suspend the context and let property panel open up whenever. Useful for frontstages that don't want the behavior
   * @param suspend If true, property panel will act like if no priority widgets exist
   */
  public static suspend(suspend: boolean) {
    PropertiesGridSelectionContext._suspended = suspend;
  }

  /** Clear listeners for selection set */
  public static clear() {
    if (PropertiesGridSelectionContext._selectionEvent) {
      PropertiesGridSelectionContext._selectionEvent.removeListener(
        PropertiesGridSelectionContext.selectionChangedHandler
      );
    }
  }

  /** Returns the priority widgets that are currently opened */
  private static getOpenedPriorityWidgets(
    activeStage: FrontstageDef
  ): WidgetDef[] {
    const priorityWidgets: WidgetDef[] = [];
    PropertiesGridSelectionContext._priorityWidgetIds.forEach(
      (widgetId: string) => {
        const widget = activeStage.findWidgetDef(widgetId);
        if (widget && widget.activeState === WidgetState.Open) {
          priorityWidgets.push(widget);
        }
      }
    );

    return priorityWidgets;
  }

  /** Check if we have at least some valid Ids in the set or if it is empty */
  private static emptyOrValidIds(ids?: Set<string>) {
    if (!ids || ids.size === 0) {
      return true;
    }

    let valid = false;
    ids!.forEach((id: string) => {
      if (!Id64.isTransient(id)) {
        valid = true;
      }
    });

    return valid;
  }

  /** Handles opening and closing the property panel on selection set changes */
  private static selectionChangedHandler(ids: Set<string>) {
    // Open/Close property panel
    const activeStage = FrontstageManager.activeFrontstageDef;
    if (activeStage) {
      const propertyWidget = activeStage.findWidgetDef(
        PropertiesGridSelectionContext._propertyPanelId
      );
      if (propertyWidget) {
        // Get widgets that we want to keep in context if they are open
        const priorityWidgets = PropertiesGridSelectionContext._suspended
          ? []
          : PropertiesGridSelectionContext.getOpenedPriorityWidgets(
              activeStage
            );

        if (PropertiesGridSelectionContext.emptyOrValidIds(ids)) {
          // If we didn't find any widgets that should override the property panel's open/hiding, react based on the selection set
          if (priorityWidgets.length === 0) {
            // Update the last state so that we show the property widget closed or opened
            if (propertyWidget.state !== WidgetState.Hidden) {
              PropertiesGridSelectionContext._propertyWidgetLastState =
                propertyWidget.state;
            }
            propertyWidget.setWidgetState(
              !ids || ids.size === 0
                ? WidgetState.Hidden
                : PropertiesGridSelectionContext._propertyWidgetLastState
            );
          } else {
            // Hide or close so that user can access property panel
            propertyWidget.setWidgetState(
              !ids || ids.size === 0 ? WidgetState.Hidden : WidgetState.Closed
            );
            // Since the call above will cause the other widgets to close, we must go ahead and open them
            priorityWidgets.forEach((widget: WidgetDef) => {
              // Close and re-open to band-aid fix widgets not showing after closing the property widget
              widget.setWidgetState(WidgetState.Closed);
              widget.setWidgetState(WidgetState.Open);
            });
          }
        }
      }
    }
  }
}
