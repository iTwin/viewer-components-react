/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { IModelApp } from "@itwin/core-frontend";
import { ToolItemDef } from "@itwin/appui-react";
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

export class MeasureToolDefinitions {
  public static get measureDistanceToolCommand() {
    return new ToolItemDef({
      toolId: MeasureDistanceTool.toolId,
      iconSpec: MeasureDistanceTool.iconSpec,
      label: () => MeasureDistanceTool.flyover,
      tooltip: () => MeasureDistanceTool.description,
      execute: () => { void IModelApp.tools.run(MeasureDistanceTool.toolId); },
    });
  }

  public static get measureAreaToolCommand() {
    return new ToolItemDef({
      toolId: MeasureAreaTool.toolId,
      iconSpec: MeasureAreaTool.iconSpec,
      label: () => MeasureAreaTool.flyover,
      tooltip: () => MeasureAreaTool.description,
      execute: () => { void IModelApp.tools.run(MeasureAreaTool.toolId); },
    });
  }

  public static get measureLocationToolCommand() {
    return new ToolItemDef({
      toolId: MeasureLocationTool.toolId,
      iconSpec: MeasureLocationTool.iconSpec,
      label: () => MeasureLocationTool.flyover,
      tooltip: () => MeasureLocationTool.description,
      execute: () => { void IModelApp.tools.run(MeasureLocationTool.toolId); },
    });
  }

  public static get clearMeasurementsToolCommand() {
    return new ToolItemDef({
      toolId: ClearMeasurementsTool.toolId,
      iconSpec: ClearMeasurementsTool.iconSpec,
      isVisible: MeasurementUIEvents.isClearMeasurementButtonVisible,
      label: () => ClearMeasurementsTool.flyover,
      tooltip: () => ClearMeasurementsTool.description,
      execute: () => { void IModelApp.tools.run(ClearMeasurementsTool.toolId); },
    });
  }

  public static get toggleDisplayMeasurementAxesToolCommand() {
    return new ToolItemDef({
      toolId: ToggleDisplayMeasurementAxesTool.toolId,
      iconSpec: ToggleDisplayMeasurementAxesTool.iconSpec,
      isVisible: MeasurementUIEvents.isToggleMeasurementAxesButtonVisible,
      label: () => (MeasurementPreferences.current.displayMeasurementAxes) ? IModelApp.localization.getLocalizedString("MeasureTools:Generic.hideMeasurementAxes") : IModelApp.localization.getLocalizedString("MeasureTools:Generic.displayMeasurementAxes"),
      tooltip: () => (MeasurementPreferences.current.displayMeasurementAxes) ? IModelApp.localization.getLocalizedString("MeasureTools:Generic.hideMeasurementAxes") : IModelApp.localization.getLocalizedString("MeasureTools:Generic.displayMeasurementAxes"),
      execute: () => { void IModelApp.tools.run(ToggleDisplayMeasurementAxesTool.toolId); },
    });
  }

  public static get measureRadiusToolCommand() {
    return new ToolItemDef({
      toolId: MeasureRadiusTool.toolId,
      iconSpec: MeasureRadiusTool.iconSpec,
      label: () => MeasureRadiusTool.flyover,
      tooltip: () => MeasureRadiusTool.description,
      execute: () => { void IModelApp.tools.run(MeasureRadiusTool.toolId); },
    });
  }

  public static get measureAngleToolCommand() {
    return new ToolItemDef({
      toolId: MeasureAngleTool.toolId,
      iconSpec: MeasureAngleTool.iconSpec,
      label: () => MeasureAngleTool.flyover,
      tooltip: () => MeasureAngleTool.description,
      execute: () => { void IModelApp.tools.run(MeasureAngleTool.toolId); },
    });
  }

  public static get measurePerpendicularToolCommand() {
    return new ToolItemDef({
      toolId: MeasurePerpendicularTool.toolId,
      iconSpec: MeasurePerpendicularTool.iconSpec,
      label: () => MeasurePerpendicularTool.flyover,
      tooltip: () => MeasurePerpendicularTool.description,
      execute: () => { void IModelApp.tools.run(MeasurePerpendicularTool.toolId); },
    });
  }
}
