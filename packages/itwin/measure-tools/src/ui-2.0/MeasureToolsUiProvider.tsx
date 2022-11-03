/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import * as React from "react";
import type {
  AbstractWidgetProps, CommonToolbarItem, UiItemsProvider,
} from "@itwin/appui-abstract";
import { WidgetState } from "@itwin/appui-abstract";
import {
  ConditionalBooleanValue, StagePanelLocation, StagePanelSection, StageUsage, ToolbarItemUtilities,
  ToolbarOrientation, ToolbarUsage,
} from "@itwin/appui-abstract";
import type { ToolItemDef } from "@itwin/appui-react";
import { SyncUiEventId, ToolbarHelper } from "@itwin/appui-react";
import { MeasurementSyncUiEventId } from "../api/MeasurementEnums";
import { MeasurementUIEvents } from "../api/MeasurementUIEvents";
import { MeasureTools } from "../MeasureTools";
import { MeasureToolDefinitions } from "../tools/MeasureToolDefinitions";
import { MeasurementPropertyWidget, MeasurementPropertyWidgetId } from "./MeasurementPropertyWidget";
import { AbstractZoneLocation } from "@itwin/appui-abstract";
import { UiFramework } from "@itwin/appui-react";
import { IModelApp } from "@itwin/core-frontend";

// Note: measure tools cannot pick geometry when a sheet view is active to snap to and therefore must be hidden
//  to avoid giving the user the impression they should work
const isSheetViewActive = () => !!IModelApp.viewManager.selectedView?.view?.isSheetView();
const isDrawingViewActive = () => !!IModelApp.viewManager.selectedView?.view?.isDrawingView();

export interface MeasureToolsUiProviderOptions {
  itemPriority?: number;
  groupPriority?: number;
  widgetPlacement?: {
    location: StagePanelLocation;
    section?: StagePanelSection;
    // eslint-disable-next-line deprecation/deprecation
    zoneLocation?: AbstractZoneLocation;
  };
}

export class MeasureToolsUiItemsProvider implements UiItemsProvider {
  public readonly id = "MeasureToolsUiItemsProvider";
  private _props?: MeasureToolsUiProviderOptions;

  constructor(props?: MeasureToolsUiProviderOptions) {
    this._props = props;
  }

  public provideToolbarButtonItems(
    _stageId: string,
    stageUsage: string,
    toolbarUsage: ToolbarUsage,
    toolbarOrientation: ToolbarOrientation,
  ): CommonToolbarItem[] {
    if (stageUsage === StageUsage.General && toolbarUsage === ToolbarUsage.ContentManipulation) {
      const featureFlags = MeasureTools.featureFlags;
      const tools: ToolItemDef[] = [];
      if (!featureFlags?.hideDistanceTool) {
        tools.push(MeasureToolDefinitions.measureDistanceToolCommand);
      }
      if (!featureFlags?.hideAreaTool) {
        tools.push(MeasureToolDefinitions.measureAreaToolCommand);
      }
      if (!featureFlags?.hideLocationTool) {
        tools.push(MeasureToolDefinitions.measureLocationToolCommand);
      }
      if (!featureFlags?.hideRadiusTool) {
        tools.push(MeasureToolDefinitions.measureRadiusToolCommand);
      }
      if (!featureFlags?.hideAngleTool) {
        tools.push(MeasureToolDefinitions.measureAngleToolCommand);
      }
      if (!featureFlags?.hidePerpendicularTool && !isDrawingViewActive()) {
        tools.push(MeasureToolDefinitions.measurePerpendicularToolCommand);
      }

      if (toolbarOrientation === ToolbarOrientation.Vertical) {
        return [
          ToolbarItemUtilities.createGroupButton(
            "measure-tools-toolbar",
            this._props?.itemPriority ?? 20,
            "icon-measure",
            MeasureTools.localization.getLocalizedString(
              "MeasureTools:MeasurementGroupButton.tooltip",
            ),
            ToolbarHelper.constructChildToolbarItems(tools),
            {
              groupPriority: this._props?.groupPriority ?? 10,
              isHidden: new ConditionalBooleanValue(
                isSheetViewActive,
                [SyncUiEventId.ViewStateChanged],
              ),
            },
          ),
        ];
      }

      if (tools.length > 0 && toolbarOrientation === ToolbarOrientation.Horizontal) {
        return [
          ToolbarHelper.createToolbarItemFromItemDef(
            100,
            MeasureToolDefinitions.clearMeasurementsToolCommand,
            {
              isHidden: new ConditionalBooleanValue(
                () => isSheetViewActive() || !MeasurementUIEvents.isClearMeasurementButtonVisible,
                [
                  SyncUiEventId.ViewStateChanged,
                  MeasurementSyncUiEventId.MeasurementSelectionSetChanged,
                  MeasurementSyncUiEventId.DynamicMeasurementChanged,
                ],
              ),
            },
          ),
        ];
      }
    }

    return [];
  }

  public provideWidgets(
    _stageId: string,
    stageUsage: string,
    location: StagePanelLocation,
    section?: StagePanelSection | undefined,
    // eslint-disable-next-line deprecation/deprecation
    zoneLocation?: AbstractZoneLocation
  ): ReadonlyArray<AbstractWidgetProps> {
    const widgets: AbstractWidgetProps[] = [];

    const preferredLocation = this._props?.widgetPlacement?.location ?? StagePanelLocation.Right;
    const preferredSection = this._props?.widgetPlacement?.section ?? StagePanelSection.Start;
    // eslint-disable-next-line deprecation/deprecation
    const preferredZoneLocation = this._props?.widgetPlacement?.zoneLocation ?? AbstractZoneLocation.CenterRight;

    if (
      (
        stageUsage === StageUsage.General &&
        location === preferredLocation &&
        section === preferredSection &&
        UiFramework.uiVersion !== "1"
      ) ||
      (
        !section &&
        stageUsage === StageUsage.General &&
        zoneLocation === preferredZoneLocation
      )
    ) {
      widgets.push({
        id: MeasurementPropertyWidgetId,
        label: MeasureTools.localization.getLocalizedString("MeasureTools:Generic.measurements"),
        getWidgetContent: () => <MeasurementPropertyWidget />, // eslint-disable-line react/display-name
        defaultState: WidgetState.Hidden,
        icon: "icon-measure",
      });
    }
    return widgets;
  }
}
