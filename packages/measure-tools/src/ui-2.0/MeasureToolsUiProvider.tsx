/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { IModelApp } from "@bentley/imodeljs-frontend";
import { I18N } from "@bentley/imodeljs-i18n";
import {
  AbstractWidgetProps,
  CommonToolbarItem,
  StagePanelLocation,
  StagePanelSection,
  StageUsage,
  ToolbarItemUtilities,
  ToolbarOrientation,
  ToolbarUsage,
  UiItemsProvider,
  ConditionalBooleanValue,
} from "@bentley/ui-abstract";
import { ToolbarHelper, ToolItemDef } from "@bentley/ui-framework";
import * as React from "react";
import { MeasurementSyncUiEventId } from "../api/MeasurementEnums";
import { MeasurementUIEvents } from "../api/MeasurementUIEvents";
import { MeasureTools } from "../MeasureTools";
import { MeasureToolDefinitions } from "../tools/MeasureToolDefinitions";
import { MeasurementPropertyWidget } from "./MeasurementPropertyWidget";

export class MeasureToolsUiItemsProvider implements UiItemsProvider {
  public readonly id = "MeasureToolsUiItemsProvider";
  public static i18n: I18N;

  public constructor(i18n?: I18N) {
    MeasureToolsUiItemsProvider.i18n = i18n ?? IModelApp.i18n;
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
            100,
            "icon-measure",
            IModelApp.i18n.translate(
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
            10,
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
  ): ReadonlyArray<AbstractWidgetProps> {
    const widgets: AbstractWidgetProps[] = [];
    if (
      stageUsage === StageUsage.General &&
      location === StagePanelLocation.Right &&
      section === StagePanelSection.Start
    ) {
      widgets.push({
        id: "measure-tools-property-widget",
        label: IModelApp.i18n.translate("MeasureTools:Generic.measurements"),
        getWidgetContent: () => <MeasurementPropertyWidget />,
      });
    }
    return widgets;
  }
}
