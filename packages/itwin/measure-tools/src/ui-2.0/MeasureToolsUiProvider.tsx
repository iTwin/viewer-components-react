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
import { MeasurementSyncUiEventId } from "../api/MeasurementEnums.js";
import { MeasurementUIEvents } from "../api/MeasurementUIEvents.js";
import { MeasureTools } from "../MeasureTools.js";
import { MeasureToolDefinitions } from "../tools/MeasureToolDefinitions.js";
import type { RecursiveRequired } from "../utils/types.js";
import { MeasurementPropertyWidget, MeasurementPropertyWidgetId } from "./MeasurementPropertyWidget.js";
import { IModelApp } from "@itwin/core-frontend";
import type { ScreenViewport } from "@itwin/core-frontend";

export interface MeasureToolsUiProviderOptions {
  itemPriority?: number;
  groupPriority?: number;
  widgetPlacement?: {
    location: StagePanelLocation;
    section?: StagePanelSection;
  };
  // If we check for sheet to 3d transformation when measuring in sheets
  enableSheetMeasurement?: boolean;
  stageUsageList?: string[];
  // Called in the isValidLocation to filter viewports the tool can be used into
  allowedViewportCallback?: (vp: ScreenViewport) => boolean;
  additionalToolbarItems?: ToolItemDef[];
  // Check if the measurement tools should be visible or hidden
  isHiddenCallback?: (activeViewport?: ScreenViewport) => boolean;
}

export class MeasureToolsUiItemsProvider implements UiItemsProvider {
  public readonly id = "MeasureToolsUiItemsProvider";
  private _props: Omit<RecursiveRequired<MeasureToolsUiProviderOptions>, 'additionalToolbarItems'> & { additionalToolbarItems?: ToolItemDef[] };

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
      allowedViewportCallback: props?.allowedViewportCallback ?? ((_vp: ScreenViewport) => {return true}),
      additionalToolbarItems: props?.additionalToolbarItems,
      isHiddenCallback: props?.isHiddenCallback ?? ((_activeViewport?: ScreenViewport) => false),
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
      const callback = this._props.allowedViewportCallback as (vp: ScreenViewport) => boolean;
      const isHiddenCallbackFunc = this._props.isHiddenCallback as (activeViewport?: ScreenViewport) => boolean;
      if (!featureFlags?.hideDistanceTool) {
        tools.push(MeasureToolDefinitions.getMeasureDistanceToolCommand(callback, this._props.enableSheetMeasurement));
      }
      if (!featureFlags?.hideAreaTool) {
        tools.push(MeasureToolDefinitions.getMeasureAreaToolCommand(callback, this._props.enableSheetMeasurement));
      }
      if (!featureFlags?.hideLocationTool) {
        tools.push(MeasureToolDefinitions.getMeasureLocationToolCommand(callback, this._props.enableSheetMeasurement));
      }
      if (!featureFlags?.hideRadiusTool) {
        tools.push(MeasureToolDefinitions.getMeasureRadiusToolCommand(callback));
      }
      if (!featureFlags?.hideAngleTool) {
        tools.push(MeasureToolDefinitions.getMeasureAngleToolCommand(callback));
      }
      if (!featureFlags?.hidePerpendicularTool) {
        tools.push(MeasureToolDefinitions.getMeasurePerpendicularToolCommand(callback));
      }
      if (this._props.additionalToolbarItems) {
        tools.push(...this._props.additionalToolbarItems);
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
                () => isHiddenCallbackFunc(IModelApp.viewManager.selectedView),
                [SyncUiEventId.ActiveViewportChanged, SyncUiEventId.ViewStateChanged],
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
                () => !MeasurementUIEvents.isClearMeasurementButtonVisible,
                [
                  SyncUiEventId.ActiveViewportChanged,
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
          content: <MeasurementPropertyWidget />,
          defaultState: WidgetState.Hidden,
          icon: "icon-measure",
        });
      }
    }
    return widgets;
  }
}
