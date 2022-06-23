/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/* eslint-disable react/display-name */

import type { AbstractWidgetProps, UiItemsProvider } from "@itwin/appui-abstract";
import {
  AbstractZoneLocation,
  StagePanelLocation,
  StagePanelSection,
  StageUsage,
  WidgetState,
} from "@itwin/appui-abstract";
import type { FrontstageDef, FrontstageReadyEventArgs } from "@itwin/appui-react";
import { FrontstageManager, UiFramework } from "@itwin/appui-react";
import { Id64 } from "@itwin/core-bentley";
import type { InstanceKey, KeySet } from "@itwin/presentation-common";
import type { ISelectionProvider, SelectionChangeEventArgs } from "@itwin/presentation-frontend";
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

/** Listen for selection changes to refresh the property grid widget state  */
const onPresentationSelectionChanged = (evt: SelectionChangeEventArgs, selectionProvider: ISelectionProvider) => {
  const selection = selectionProvider.getSelection(evt.imodel, evt.level);
  updateWidgetStateFromSelection(selection, FrontstageManager.activeFrontstageDef);
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
    if (UiFramework.uiVersion === "1") {
      const removePresentationListener = Presentation.selection.selectionChange.addListener(onPresentationSelectionChanged);
      const removeFronstageReadyListener = FrontstageManager.onFrontstageReadyEvent.addListener(onFrontstageReadyEvent);
      this._removeListeners = () => {
        removePresentationListener();
        removeFronstageReadyListener();
      };
    }
  }

  // When the provider is unloaded also remove the handler
  public onUnregister = () => {
    this._removeListeners?.();
  };

  public provideWidgets(
    _stageId: string,
    stageUsage: string,
    location: StagePanelLocation,
    section?: StagePanelSection | undefined,
    // eslint-disable-next-line deprecation/deprecation
    zoneLocation?: AbstractZoneLocation
  ): ReadonlyArray<AbstractWidgetProps> {
    const widgets: AbstractWidgetProps[] = [];
    const preferredLocation = this._props?.defaultPanelLocation ?? StagePanelLocation.Right;
    const preferredPanelSection = this._props?.defaultPanelSection ?? StagePanelSection.End;
    // eslint-disable-next-line deprecation/deprecation
    const preferredZoneLocation = this._props?.defaultZoneLocation ?? AbstractZoneLocation.CenterRight;
    if (
      (
        stageUsage === StageUsage.General &&
        location === preferredLocation &&
        section === preferredPanelSection &&
        UiFramework.uiVersion !== "1"
      ) ||
      (
        !section &&
        stageUsage === StageUsage.General &&
        zoneLocation === preferredZoneLocation
      )
    ) {
      widgets.push({
        id: MultiElementPropertyGridId,
        label: PropertyGridManager.translate("widget-label"),
        getWidgetContent: () => <MultiElementPropertyGrid {...this._props} />,
        defaultState: WidgetState.Hidden,
        icon: "icon-info",
        priority: this._props?.defaultPanelWidgetPriority,
      });
    }

    return widgets;
  }
}
