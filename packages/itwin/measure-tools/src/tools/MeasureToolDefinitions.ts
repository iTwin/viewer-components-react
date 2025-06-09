/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { IModelApp } from "@itwin/core-frontend";
import type { ScreenViewport } from "@itwin/core-frontend";
import { SyncUiEventId, ToolItemDef } from "@itwin/appui-react";
import { MeasurementPreferences } from "../api/MeasurementPreferences.js";
import { MeasurementUIEvents } from "../api/MeasurementUIEvents.js";
import { ClearMeasurementsTool } from "./ClearMeasurementsTool.js";
import { MeasureAngleTool } from "./MeasureAngleTool.js";
import { MeasureAreaTool } from "./MeasureAreaTool.js";
import { MeasureDistanceTool } from "./MeasureDistanceTool.js";
import { MeasureLocationTool } from "./MeasureLocationTool.js";
import { MeasurePerpendicularTool } from "./MeasurePerpendicularTool.js";
import { MeasureRadiusTool } from "./MeasureRadiusTool.js";
import { ToggleDisplayMeasurementAxesTool } from "./ToggleDisplayMeasurementAxesTool.js";
import { MeasureTools } from "../MeasureTools.js";
import { ConditionalBooleanValue } from "@itwin/appui-abstract";
import type { DistanceMeasurementFormattingProps } from "../measurements/DistanceMeasurement.js";
import type { AreaMeasurementFormattingProps } from "../measurements/AreaMeasurement.js";
import type { LocationMeasurementFormattingProps } from "../measurements/LocationMeasurement.js";
import type { AngleMeasurementFormattingProps } from "../measurements/AngleMeasurement.js";
import type { RadiusMeasurementFormattingProps } from "../measurements/RadiusMeasurement.js";

export class MeasureToolDefinitions {

  /**
   * @deprecated in 0.14.2 use getMeasureDistanceToolCommand instead
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

  public static getMeasureDistanceToolCommand(allowedViewportCallback: (vp: ScreenViewport) => boolean = (() => true), enableSheetMeasurements: boolean, formatting?: DistanceMeasurementFormattingProps) {
    return new ToolItemDef({
      toolId: MeasureDistanceTool.toolId,
      iconSpec: MeasureDistanceTool.iconSpec,
      label: () => MeasureDistanceTool.flyover,
      tooltip: () => MeasureDistanceTool.description,
      execute: () => {
        const tool = new MeasureDistanceTool(enableSheetMeasurements, allowedViewportCallback, formatting);
        void tool.run();
      },
    });
  }

  /**
   * @deprecated in 0.14.2 use getMeasureAreaToolCommand instead
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

  public static getMeasureAreaToolCommand(allowedViewportCallback: (vp: ScreenViewport) => boolean = (() => true), enableSheetMeasurements: boolean, formatting?: AreaMeasurementFormattingProps) {
    return new ToolItemDef({
      toolId: MeasureAreaTool.toolId,
      iconSpec: MeasureAreaTool.iconSpec,
      label: () => MeasureAreaTool.flyover,
      tooltip: () => MeasureAreaTool.description,
      execute: () => {
        const tool = new MeasureAreaTool(enableSheetMeasurements, allowedViewportCallback, formatting);
        void tool.run();
      },
    });
  }

  /**
   * @deprecated in 0.15.0 use getMeasureLocationToolCommand instead
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

  public static getMeasureLocationToolCommand(allowedViewportCallback: (vp: ScreenViewport) => boolean = (() => true), enableSheetMeasurements: boolean, formatting?: LocationMeasurementFormattingProps) {
    return new ToolItemDef({
      toolId: MeasureLocationTool.toolId,
      iconSpec: MeasureLocationTool.iconSpec,
      label: () => MeasureLocationTool.flyover,
      tooltip: () => MeasureLocationTool.description,
      execute: () => {
        const tool = new MeasureLocationTool(enableSheetMeasurements, allowedViewportCallback, formatting);
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

  /**
   * @deprecated in 0.23.1 use getMeasureRadiusToolCommand instead
   */
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

  public static getMeasureRadiusToolCommand(allowedViewportCallback: (vp: ScreenViewport) => boolean = (() => true), formatting?: RadiusMeasurementFormattingProps) {
    return new ToolItemDef({
      toolId: MeasureRadiusTool.toolId,
      iconSpec: MeasureRadiusTool.iconSpec,
      label: () => MeasureRadiusTool.flyover,
      tooltip: () => MeasureRadiusTool.description,
      execute: () => {
        const tool = new MeasureRadiusTool(allowedViewportCallback, formatting);
        void tool.run();
      },
    });
  }

  /**
   * @deprecated in 0.23.1 use getMeasureRadiusToolCommand instead
   */
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

  public static getMeasureAngleToolCommand(allowedViewportCallback: (vp: ScreenViewport) => boolean = (() => true), formatting?: AngleMeasurementFormattingProps) {
    return new ToolItemDef({
      toolId: MeasureAngleTool.toolId,
      iconSpec: MeasureAngleTool.iconSpec,
      label: () => MeasureAngleTool.flyover,
      tooltip: () => MeasureAngleTool.description,
      execute: () => {
        const tool = new MeasureAngleTool(allowedViewportCallback, formatting);
        void tool.run();
      },
    });
  }

  /**
   * @deprecated in 0.23.1 use getMeasureRadiusToolCommand instead
   */
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

  public static getMeasurePerpendicularToolCommand(allowedViewportCallback: (vp: ScreenViewport) => boolean = (() => true), formatting?: DistanceMeasurementFormattingProps) {
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
        const tool = new MeasurePerpendicularTool(allowedViewportCallback, formatting);
        void tool.run();
      },
    });
  }
}
