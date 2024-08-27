/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import * as React from "react";
import { ConditionalBooleanValue } from "@itwin/appui-abstract";
import type { ToolbarItem, ToolItemDef, UiItemsProvider, Widget } from "@itwin/appui-react";
import {
  StagePanelLocation, StagePanelSection, StageUsage, SyncUiEventId, ToolbarHelper, ToolbarItemUtilities,
  ToolbarOrientation, ToolbarUsage, WidgetState,
} from "@itwin/appui-react";
import { MeasurementSyncUiEventId } from "../api/MeasurementEnums";
import { MeasurementUIEvents } from "../api/MeasurementUIEvents";
import { MeasureTools } from "../MeasureTools";
import { MeasureToolDefinitions } from "../tools/MeasureToolDefinitions";
import type { RecursiveRequired } from "../utils/types";
import { MeasurementPropertyWidget, MeasurementPropertyWidgetId } from "./MeasurementPropertyWidget";
import { IModelApp } from "@itwin/core-frontend";

// Note: measure tools cannot pick geometry when a sheet view is active to snap to and therefore must be hidden
//  to avoid giving the user the impression they should work
const isSheetViewActive = () => !!IModelApp.viewManager.selectedView?.view?.isSheetView();

export interface MeasureToolsUiProviderOptions {
  itemPriority?: number;
  groupPriority?: number;
  widgetPlacement?: {
    location: StagePanelLocation;
    section?: StagePanelSection;
  };
  // If we check for sheet to 3d transformation when measuring in sheets
  enableSheetMeasurement?: boolean;
  // Callback that is invoked when a tracked feature is used.
  onFeatureUsed?: (feature: string) => void;
  stageUsageList?: string[];
}


export class MeasureToolsUiItemsProvider implements UiItemsProvider {
  public readonly id = "MeasureToolsUiItemsProvider";
  private _props: RecursiveRequired<MeasureToolsUiProviderOptions>;

  constructor(props?: MeasureToolsUiProviderOptions) {
    this._props = {
      itemPriority: props?.itemPriority ?? 20,
      groupPriority: props?.groupPriority ?? 10,
      widgetPlacement: {
        location: props?.widgetPlacement?.location ?? StagePanelLocation.Right,
        section: props?.widgetPlacement?.section ?? StagePanelSection.Start,
      },
      enableSheetMeasurement: props?.enableSheetMeasurement ?? false,
      stageUsageList: props?.stageUsageList ?? [StageUsage.General],
    };
  }

  public provideToolbarItems(
    _stageId: string,
    stageUsage: string,
    toolbarUsage: ToolbarUsage,
    toolbarOrientation: ToolbarOrientation,
  ): ToolbarItem[] {
    if (this._props.stageUsageList.includes(stageUsage) && toolbarUsage === ToolbarUsage.ContentManipulation) {
      const featureFlags = MeasureTools.featureFlags;
      const tools: ToolItemDef[] = [];
      if (!featureFlags?.hideDistanceTool) {
        tools.push(MeasureToolDefinitions.getMeasureDistanceToolCommand(this._props?.enableSheetMeasurement, this._props?.onFeatureUsed));
      }
      if (!featureFlags?.hideAreaTool) {
        tools.push(MeasureToolDefinitions.getMeasureAreaToolCommand(this._props.enableSheetMeasurement));
      }
      if (!featureFlags?.hideLocationTool) {
        tools.push(MeasureToolDefinitions.getMeasureLocationToolCommand(this._props.enableSheetMeasurement));
      }
      if (!featureFlags?.hideRadiusTool) {
        tools.push(MeasureToolDefinitions.measureRadiusToolCommand);
      }
      if (!featureFlags?.hideAngleTool) {
        tools.push(MeasureToolDefinitions.measureAngleToolCommand);
      }
      if (!featureFlags?.hidePerpendicularTool) {
        tools.push(MeasureToolDefinitions.measurePerpendicularToolCommand);
      }

      if (toolbarOrientation === ToolbarOrientation.Vertical) {
        return [
          ToolbarItemUtilities.createGroupItem(
            "measure-tools-toolbar",
            this._props.itemPriority,
            "icon-measure",
            MeasureTools.localization.getLocalizedString(
              "MeasureTools:MeasurementGroupButton.tooltip",
            ),
            ToolbarHelper.constructChildToolbarItems(tools),
            {
              groupPriority: this._props.groupPriority,
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
            MeasureToolDefinitions.getClearMeasurementsToolCommand(this._props?.onFeatureUsed),
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
  ): ReadonlyArray<Widget> {
    const widgets: Widget[] = [];
    const preferredLocation = this._props.widgetPlacement.location;
    const preferredSection = this._props.widgetPlacement.section;
    if (this._props.stageUsageList.includes(stageUsage) && location === preferredLocation && section === preferredSection) {
      {
        widgets.push({
          id: MeasurementPropertyWidgetId,
          label: MeasureTools.localization.getLocalizedString("MeasureTools:Generic.measurements"),
          content: <MeasurementPropertyWidget onFeatureUsed={this._props?.onFeatureUsed} />,
          defaultState: WidgetState.Hidden,
          icon: "icon-measure",
        });
      }
    }
    return widgets;
  }
}
