/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import * as React from "react";
import {
  ConditionalBooleanValue,
} from "@itwin/appui-abstract";
import type {
  ToolbarItem,
  ToolItemDef, Widget,
} from "@itwin/appui-react";
import {
  SyncUiEventId, ToolbarHelper, StageUsage, ToolbarItemUtilities,
  ToolbarOrientation, ToolbarUsage, UiItemsProvider, WidgetState
} from "@itwin/appui-react";
import { MeasurementSyncUiEventId } from "../api/MeasurementEnums";
import { MeasurementUIEvents } from "../api/MeasurementUIEvents";
import { MeasureTools } from "../MeasureTools";
import { MeasureToolDefinitions } from "../tools/MeasureToolDefinitions";
import { MeasurementPropertyWidget, MeasurementPropertyWidgetId } from "./MeasurementPropertyWidget";
import { IModelApp } from "@itwin/core-frontend";

// Note: measure tools cannot pick geometry when a sheet view is active to snap to and therefore must be hidden
//  to avoid giving the user the impression they should work
const isSheetViewActive = () => !!IModelApp.viewManager.selectedView?.view?.isSheetView();

export interface MeasureToolsUiProviderOptions {
  itemPriority?: number;
  groupPriority?: number;
}

export class MeasureToolsUiItemsProvider implements UiItemsProvider {
  public readonly id = "MeasureToolsUiItemsProvider";
  private _props?: MeasureToolsUiProviderOptions;

  constructor(props?: MeasureToolsUiProviderOptions) {
    this._props = props;
  }

  public provideToolbarItems(
    _stageId: string,
    stageUsage: string,
    toolbarUsage: ToolbarUsage,
    toolbarOrientation: ToolbarOrientation,
  ): ToolbarItem[] {
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
      if (!featureFlags?.hidePerpendicularTool) {
        tools.push(MeasureToolDefinitions.measurePerpendicularToolCommand);
      }

      if (toolbarOrientation === ToolbarOrientation.Vertical) {
        return [
          ToolbarItemUtilities.createGroupItem(
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
  ): ReadonlyArray<Widget> {
    const widgets: Widget[] = [];
    {
      widgets.push({
        id: MeasurementPropertyWidgetId,
        label: MeasureTools.localization.getLocalizedString("MeasureTools:Generic.measurements"),
        content: <MeasurementPropertyWidget />,
        defaultState: WidgetState.Hidden,
        icon: "icon-measure",
      });
    }
    return widgets;
  }
}
