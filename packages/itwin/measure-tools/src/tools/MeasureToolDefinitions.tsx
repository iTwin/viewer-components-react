/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { IModelApp } from "@itwin/core-frontend";
import { SyncUiEventId, ToolItemDef } from "@itwin/appui-react";
import { MeasurementPreferences } from "../api/MeasurementPreferences";
import { MeasurementUIEvents } from "../api/MeasurementUIEvents";
import { ClearMeasurementsTool } from "./ClearMeasurementsTool";
import { MeasureAngleTool } from "./MeasureAngleTool";
import { MeasureAreaTool } from "./MeasureAreaTool";
import { MeasureDistanceTool } from "./MeasureDistanceTool";
import { MeasureLocationTool } from "./MeasureLocationTool";
import { MeasurePerpendicularTool } from "./MeasurePerpendicularTool";
import { MeasureRadiusTool } from "./MeasureRadiusTool";
import { ToggleDisplayMeasurementAxesTool } from "./ToggleDisplayMeasurementAxesTool";
import { MeasureTools } from "../MeasureTools";
import { ConditionalBooleanValue } from "@itwin/appui-abstract";
import { MeasureHeightTool } from "./MeasureHeightTool";
import { MeasureWidthTool } from "./MeasureWidthTool";
import React from "react";

export class MeasureToolDefinitions {

  /**
   * @deprecated in 0.14.2 use getMeasureDistanceToolCommand(enableSheetMeasurements: boolean) instead
   */
  public static get measureDistanceToolCommand() {
    return new ToolItemDef({
      toolId: MeasureDistanceTool.toolId,
      iconSpec: MeasureDistanceTool.iconSpec,
      label: () => MeasureDistanceTool.flyover,
      tooltip: () => MeasureDistanceTool.description,
      execute: () => {
        void IModelApp.tools.run(MeasureDistanceTool.toolId);
      },
    });
  }

  public static getMeasureDistanceToolCommand(enableSheetMeasurements: boolean) {
    return new ToolItemDef({
      toolId: MeasureDistanceTool.toolId,
      iconSpec: MeasureDistanceTool.iconSpec,
      label: () => MeasureDistanceTool.flyover,
      tooltip: () => MeasureDistanceTool.description,
      execute: () => {
        const tool = new MeasureDistanceTool(enableSheetMeasurements);
        void tool.run();
      },
    });
  }

  public static getMeasureHeightToolCommand(enableSheetMeasurements: boolean) {
    const HeightIcon = () => {
      return (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16">
          <g>
            <rect x="4" width="1" height="16"/>
            <polygon points="12,15 10.125,15 12,12 10,12 10,4 12,4 10.125,1 12,1 12,0 7,0 7,1 8.875,1 7,4 9,4 9,12 7,12 8.875,15 7,15 7,16    12,16  "/>
          </g>
        </svg>
      );
    };
    return new ToolItemDef({
      toolId: MeasureHeightTool.toolId,
      iconSpec: HeightIcon(),
      label: () => MeasureHeightTool.flyover,
      tooltip: () => MeasureHeightTool.description,
      execute: () => {
        const tool = new MeasureHeightTool(enableSheetMeasurements);
        void tool.run();
      },
    });
  }
  public static getMeasureWidthToolCommand(enableSheetMeasurements: boolean) {
    const WidthIcon = () => {
      return (
        <svg version="1.1" xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32">
          <path d="M0 24v-2h32v2h-32zM30 11.75l-6-3.75v4h-16v-4l-6 3.75v-3.75h-2v10h2v-3.75l6 3.75v-4h16v4l6-3.75v3.75h2v-10h-2z"></path>
        </svg>
      );
    };

    return new ToolItemDef({
      toolId: MeasureWidthTool.toolId,
      iconSpec: WidthIcon(),
      label: () => MeasureWidthTool.flyover,
      tooltip: () => MeasureWidthTool.description,
      execute: () => {
        const tool = new MeasureWidthTool(enableSheetMeasurements);
        void tool.run();
      },
    });
  }

  /**
   * @deprecated in 0.14.2 use getMeasureAreaToolCommand(enableSheetMeasurements: boolean) instead
   */
  public static get measureAreaToolCommand() {
    return new ToolItemDef({
      toolId: MeasureAreaTool.toolId,
      iconSpec: MeasureAreaTool.iconSpec,
      label: () => MeasureAreaTool.flyover,
      tooltip: () => MeasureAreaTool.description,
      execute: () => {
        void IModelApp.tools.run(MeasureAreaTool.toolId);
      },
    });
  }

  public static getMeasureAreaToolCommand(enableSheetMeasurements: boolean) {
    return new ToolItemDef({
      toolId: MeasureAreaTool.toolId,
      iconSpec: MeasureAreaTool.iconSpec,
      label: () => MeasureAreaTool.flyover,
      tooltip: () => MeasureAreaTool.description,
      execute: () => {
        const tool = new MeasureAreaTool(enableSheetMeasurements);
        void tool.run();
      },
    });
  }

  /**
   * @deprecated in 0.15.0 use getMeasureLocationToolCommand(enableSheetMeasurements: boolean) instead
   */
  public static get measureLocationToolCommand() {
    return new ToolItemDef({
      toolId: MeasureLocationTool.toolId,
      iconSpec: MeasureLocationTool.iconSpec,
      label: () => MeasureLocationTool.flyover,
      tooltip: () => MeasureLocationTool.description,
      execute: () => {
        void IModelApp.tools.run(MeasureLocationTool.toolId);
      },
    });
  }

  public static getMeasureLocationToolCommand(enableSheetMeasurements: boolean) {
    return new ToolItemDef({
      toolId: MeasureLocationTool.toolId,
      iconSpec: MeasureLocationTool.iconSpec,
      label: () => MeasureLocationTool.flyover,
      tooltip: () => MeasureLocationTool.description,
      execute: () => {
        const tool = new MeasureLocationTool(enableSheetMeasurements);
        void tool.run();
      },
    });
  }

  public static get clearMeasurementsToolCommand() {
    return new ToolItemDef({
      toolId: ClearMeasurementsTool.toolId,
      iconSpec: ClearMeasurementsTool.iconSpec,
      isHidden: !MeasurementUIEvents.isClearMeasurementButtonVisible,
      label: () => ClearMeasurementsTool.flyover,
      tooltip: () => ClearMeasurementsTool.description,
      execute: () => {
        void IModelApp.tools.run(ClearMeasurementsTool.toolId);
      },
    });
  }

  public static get toggleDisplayMeasurementAxesToolCommand() {
    return new ToolItemDef({
      toolId: ToggleDisplayMeasurementAxesTool.toolId,
      iconSpec: ToggleDisplayMeasurementAxesTool.iconSpec,
      isHidden: !MeasurementUIEvents.isToggleMeasurementAxesButtonVisible,
      label: () =>
        MeasurementPreferences.current.displayMeasurementAxes
          ? MeasureTools.localization.getLocalizedString(
            "MeasureTools:Generic.hideMeasurementAxes"
          )
          : MeasureTools.localization.getLocalizedString(
            "MeasureTools:Generic.displayMeasurementAxes"
          ),
      tooltip: () =>
        MeasurementPreferences.current.displayMeasurementAxes
          ? MeasureTools.localization.getLocalizedString(
            "MeasureTools:Generic.hideMeasurementAxes"
          )
          : MeasureTools.localization.getLocalizedString(
            "MeasureTools:Generic.displayMeasurementAxes"
          ),
      execute: () => {
        void IModelApp.tools.run(ToggleDisplayMeasurementAxesTool.toolId);
      },
    });
  }

  public static get measureRadiusToolCommand() {
    return new ToolItemDef({
      toolId: MeasureRadiusTool.toolId,
      iconSpec: MeasureRadiusTool.iconSpec,
      label: () => MeasureRadiusTool.flyover,
      tooltip: () => MeasureRadiusTool.description,
      execute: () => {
        void IModelApp.tools.run(MeasureRadiusTool.toolId);
      },
    });
  }

  public static get measureAngleToolCommand() {
    return new ToolItemDef({
      toolId: MeasureAngleTool.toolId,
      iconSpec: MeasureAngleTool.iconSpec,
      label: () => MeasureAngleTool.flyover,
      tooltip: () => MeasureAngleTool.description,
      execute: () => {
        void IModelApp.tools.run(MeasureAngleTool.toolId);
      },
    });
  }

  public static get measurePerpendicularToolCommand() {
    return new ToolItemDef({
      toolId: MeasurePerpendicularTool.toolId,
      iconSpec: MeasurePerpendicularTool.iconSpec,
      label: () => MeasurePerpendicularTool.flyover,
      tooltip: () => MeasurePerpendicularTool.description,
      isHidden: new ConditionalBooleanValue(
        () => !!IModelApp.viewManager.selectedView?.view?.is2d(),
        [SyncUiEventId.ViewStateChanged]
      ),
      execute: () => {
        void IModelApp.tools.run(MeasurePerpendicularTool.toolId);
      },
    });
  }
}
