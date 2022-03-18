/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import * as React from "react";
import { IModelApp } from "@itwin/core-frontend";
import type { Localization } from "@itwin/core-common";
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
  public static localization: Localization;

  public constructor(localization?: Localization) {
    MeasureToolsUiItemsProvider.localization = localization ?? IModelApp.localization;
  }

  public provideToolbarButtonItems(
    _stageId: string,
    stageUsage: string,
    toolbarUsage: ToolbarUsage,
    toolbarOrientation: ToolbarOrientation,
  ): CommonToolbarItem[] {
    if (
      stageUsage === StageUsage.General &&
      toolbarUsage === ToolbarUsage.ContentManipulation
    ) {
      const featureFlags = MeasureTools.featureFlags;
      if (toolbarOrientation === ToolbarOrientation.Vertical) {
        const tools: ToolItemDef[] = [];
        if (featureFlags.enableDistanceTool) {
          tools.push(MeasureToolDefinitions.measureDistanceToolCommand);
        }
        if (featureFlags.enableAreaTool) {
          tools.push(MeasureToolDefinitions.measureAreaToolCommand);
        }
        if (featureFlags.enableLocationTool) {
          tools.push(MeasureToolDefinitions.measureLocationToolCommand);
        }
        if (featureFlags.enableRadiusTool) {
          tools.push(MeasureToolDefinitions.measureRadiusToolCommand);
        }
        if (featureFlags.enableAngleTool) {
          tools.push(MeasureToolDefinitions.measureAngleToolCommand);
        }
        if (featureFlags.enablePerpendicularTool) {
          tools.push(MeasureToolDefinitions.measurePerpendicularToolCommand);
        }
        return [
          ToolbarItemUtilities.createGroupButton(
            "measure-tools-toolbar",
            500,
            "icon-measure",
            IModelApp.localization.getLocalizedString(
              "MeasureTools:MeasurementGroupButton.tooltip",
            ),
            ToolbarHelper.constructChildToolbarItems(tools),
          ),
        ];
      }
      if (
        Object.values(featureFlags).some(Boolean) &&
        toolbarOrientation === ToolbarOrientation.Horizontal
      ) {
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
        label: IModelApp.localization.getLocalizedString("MeasureTools:Generic.measurements"),
        getWidgetContent: () => <MeasurementPropertyWidget />, // eslint-disable-line react/display-name
        defaultState: WidgetState.Hidden,
        icon: "icon-measure",
      });
    }
    return widgets;
  }
}
