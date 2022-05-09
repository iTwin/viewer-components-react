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
import { FrontstageManager, UiFramework } from "@itwin/appui-react";
import { Id64 } from "@itwin/core-bentley";
import type { InstanceKey } from "@itwin/presentation-common";
import type { ISelectionProvider, SelectionChangeEventArgs } from "@itwin/presentation-frontend";
import { Presentation } from "@itwin/presentation-frontend";
import * as React from "react";

import { MultiElementPropertyGrid, MultiElementPropertyGridId } from "./components/MultiElementPropertyGrid";
import { PropertyGridManager } from "./PropertyGridManager";
import type { PropertyGridProps } from "./types";

/** Listen for selection changes and when nothing is selection hide the Widget by calling widgetDef.setWidgetState  */
const onPresentationSelectionChanged = async (evt: SelectionChangeEventArgs, selectionProvider: ISelectionProvider) => {
  const widgetDef = FrontstageManager.activeFrontstageDef?.findWidgetDef(MultiElementPropertyGridId);
  if (widgetDef) {
    const selection = selectionProvider.getSelection(evt.imodel, evt.level);
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
      widgetDef.setWidgetState(WidgetState.Open);
    } else {
      widgetDef.setWidgetState(WidgetState.Hidden);
    }
  }
};

/** Provides the property grid widget to zone 9 */
export class PropertyGridUiItemsProvider implements UiItemsProvider {
  public readonly id = "PropertyGridUiItemsProvider";
  public static readonly providerId = "PropertyGridUiItemsProvider";
  private _removeListenerFunc?: () => void;
  private _props?: PropertyGridProps;

  constructor(props?: PropertyGridProps) {
    this._props = props;
    if (UiFramework.uiVersion === "1") {
      this._removeListenerFunc = Presentation.selection.selectionChange.addListener(onPresentationSelectionChanged);
    }
  }

  // When the provider is unloaded also remove the handler
  public onUnregister = () => {
    this._removeListenerFunc && this._removeListenerFunc();
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
        // eslint-disable-next-line deprecation/deprecation
        zoneLocation === AbstractZoneLocation.CenterRight
      )
    ) {
      widgets.push({
        id: MultiElementPropertyGridId,
        label: PropertyGridManager.translate("widget-label"),
        getWidgetContent: () => <MultiElementPropertyGrid {...this._props} />,
        defaultState: WidgetState.Hidden,
        icon: "icon-info",
      });
    }

    return widgets;
  }
}
