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
import { ToolbarHelper } from "@itwin/appui-react";
import { MeasurementSyncUiEventId } from "../api/MeasurementEnums";
import { MeasurementUIEvents } from "../api/MeasurementUIEvents";
import { MeasureTools } from "../MeasureTools";
import { MeasureToolDefinitions } from "../tools/MeasureToolDefinitions";
import { MeasurementPropertyWidget, MeasurementPropertyWidgetId } from "./MeasurementPropertyWidget";
import { AbstractZoneLocation } from "@itwin/appui-abstract";
import { UiFramework } from "@itwin/appui-react";

export class MeasureToolsUiItemsProvider implements UiItemsProvider {
  public readonly id = "MeasureToolsUiItemsProvider";
  private _props?: { itemPriority: number };

  constructor(props?: { itemPriority: number }) {
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
      if (!featureFlags?.hidePerpendicularTool) {
        tools.push(MeasureToolDefinitions.measurePerpendicularToolCommand);
      }

      if (toolbarOrientation === ToolbarOrientation.Vertical) {
        return [
          ToolbarItemUtilities.createGroupButton(
            "measure-tools-toolbar",
            this._props?.itemPriority || 500,
            "icon-measure",
            MeasureTools.localization.getLocalizedString(
              "MeasureTools:MeasurementGroupButton.tooltip",
            ),
            ToolbarHelper.constructChildToolbarItems(tools),
          ),
        ];
      }

      if (tools.length > 0 && toolbarOrientation === ToolbarOrientation.Horizontal) {
        const isHidden = new ConditionalBooleanValue(
          () => !MeasurementUIEvents.isClearMeasurementButtonVisible,
          [
            MeasurementSyncUiEventId.MeasurementSelectionSetChanged,
            MeasurementSyncUiEventId.DynamicMeasurementChanged,
          ],
        );
        return [
          ToolbarHelper.createToolbarItemFromItemDef(
            100,
            MeasureToolDefinitions.clearMeasurementsToolCommand,
            {
              isHidden,
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
    if (
      (
        stageUsage === StageUsage.General &&
        location === StagePanelLocation.Right &&
        section === StagePanelSection.Start &&
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
