/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/* eslint-disable react/display-name */

import type { CommonWidgetProps, UiItemsProvider } from "@itwin/appui-react";
import type { FrontstageDef, FrontstageReadyEventArgs } from "@itwin/appui-react";
import {
  UiFramework,
  StagePanelLocation,
  StagePanelSection,
  StageUsage,
  WidgetState,
} from "@itwin/appui-react";
import { Id64 } from "@itwin/core-bentley";
import type { InstanceKey, KeySet } from "@itwin/presentation-common";
import { Presentation } from "@itwin/presentation-frontend";
import * as React from "react";

import { MultiElementPropertyGrid, MultiElementPropertyGridId } from "./components/MultiElementPropertyGrid";
import { PropertyGridManager } from "./PropertyGridManager";
import type { PropertyGridProps } from "./types";

/**
 * Update the property grid widget state based on the current widget state and the selection set
 * if no selection with non transient elements found, hide widget
 * if some non transient elements are found and the widget isn't minimized, open widget
 */
const updateWidgetStateFromSelection = (selection: Readonly<KeySet>, frontstageDef?: FrontstageDef) => {
  const widgetDef = frontstageDef?.findWidgetDef(MultiElementPropertyGridId);
  if (widgetDef) {
    const instanceKeys: InstanceKey[] = [];
    selection.instanceKeys.forEach(
      (ids: Set<string>, className: string) => {
        ids.forEach((id: string) => {
          instanceKeys.push({
            id,
            className,
          });
        });
      }
    );
    if (instanceKeys.some((key) => !Id64.isTransient(key.id))) {
      // if the widget is minimized, do not force it open
      if (widgetDef.activeState === WidgetState.Hidden) {
        widgetDef.setWidgetState(WidgetState.Open);
      }
    } else {
      widgetDef.setWidgetState(WidgetState.Hidden);
    }
  }
};

/**
 * Listen for frontstage changes to refresh the property grid widget state
 * This is required if a frontstage is opened while a selection is active to restore the correct widget state
 * Note only needed in UI 1.0, otherwise the MultiElementPropertyGrid onSelectionChange useEffect would cover this since in UI 2.0 the widget stays mounted
 */
const onFrontstageReadyEvent = (args: FrontstageReadyEventArgs) => {
  const iModel = UiFramework.getIModelConnection();
  if (iModel) {
    const selection = Presentation.selection.getSelection(iModel);
    updateWidgetStateFromSelection(selection, args.frontstageDef);
  }
};

/** Provides the property grid widget to zone 9 */
export class PropertyGridUiItemsProvider implements UiItemsProvider {
  public readonly id = "PropertyGridUiItemsProvider";
  public static readonly providerId = "PropertyGridUiItemsProvider";
  private _removeListeners?: () => void;
  private _props?: PropertyGridProps;

  constructor(props?: PropertyGridProps) {
    this._props = props;
  }

  // When the provider is unloaded also remove the handler
  public onUnregister = () => {
    this._removeListeners?.();
  };

  public provideWidgets(
    _stageId: string,
    _stageUsage: string,
    _location: StagePanelLocation,

  ): ReadonlyArray<CommonWidgetProps> {
    const widgets: CommonWidgetProps[] = [];

    widgets.push({
      id: MultiElementPropertyGridId,
      label: PropertyGridManager.translate("widget-label"),
      getWidgetContent: () => <MultiElementPropertyGrid {...this._props} />,
      defaultState: WidgetState.Hidden,
      icon: "icon-info",
      priority: this._props?.defaultPanelWidgetPriority,
    });


    return widgets;
  }
}
