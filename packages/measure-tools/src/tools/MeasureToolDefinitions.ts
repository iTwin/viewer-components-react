/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { IModelApp } from "@bentley/imodeljs-frontend";
import { ToolItemDef } from "@bentley/ui-framework";
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
      execute: () => { IModelApp.tools.run(MeasureDistanceTool.toolId); },
    });
  }

  public static get measureAreaToolCommand() {
    return new ToolItemDef({
      toolId: MeasureAreaTool.toolId,
      iconSpec: MeasureAreaTool.iconSpec,
      label: () => MeasureAreaTool.flyover,
      tooltip: () => MeasureAreaTool.description,
      execute: () => { IModelApp.tools.run(MeasureAreaTool.toolId); },
    });
  }

  public static get measureLocationToolCommand() {
    return new ToolItemDef({
      toolId: MeasureLocationTool.toolId,
      iconSpec: MeasureLocationTool.iconSpec,
      label: () => MeasureLocationTool.flyover,
      tooltip: () => MeasureLocationTool.description,
      execute: () => { IModelApp.tools.run(MeasureLocationTool.toolId); },
    });
  }

  public static get clearMeasurementsToolCommand() {
    return new ToolItemDef({
      toolId: ClearMeasurementsTool.toolId,
      iconSpec: ClearMeasurementsTool.iconSpec,
      isVisible: MeasurementUIEvents.isClearMeasurementButtonVisible,
      label: () => ClearMeasurementsTool.flyover,
      tooltip: () => ClearMeasurementsTool.description,
      execute: () => { IModelApp.tools.run(ClearMeasurementsTool.toolId); },
    });
  }

  public static get toggleDisplayMeasurementAxesToolCommand() {
    return new ToolItemDef({
      toolId: ToggleDisplayMeasurementAxesTool.toolId,
      iconSpec: ToggleDisplayMeasurementAxesTool.iconSpec,
      isVisible: MeasurementUIEvents.isToggleMeasurementAxesButtonVisible,
      label: () => (MeasurementPreferences.current.displayMeasurementAxes) ? IModelApp.i18n.translate("MeasureTools:Generic.hideMeasurementAxes") : IModelApp.i18n.translate("MeasureTools:Generic.displayMeasurementAxes"),
      tooltip: () => (MeasurementPreferences.current.displayMeasurementAxes) ? IModelApp.i18n.translate("MeasureTools:Generic.hideMeasurementAxes") : IModelApp.i18n.translate("MeasureTools:Generic.displayMeasurementAxes"),
      execute: () => { IModelApp.tools.run(ToggleDisplayMeasurementAxesTool.toolId); },
    });
  }

  public static get measureRadiusToolCommand() {
    return new ToolItemDef({
      toolId: MeasureRadiusTool.toolId,
      iconSpec: MeasureRadiusTool.iconSpec,
      label: () => MeasureRadiusTool.flyover,
      tooltip: () => MeasureRadiusTool.description,
      execute: () => { IModelApp.tools.run(MeasureRadiusTool.toolId); },
    });
  }

  public static get measureAngleToolCommand() {
    return new ToolItemDef({
      toolId: MeasureAngleTool.toolId,
      iconSpec: MeasureAngleTool.iconSpec,
      label: () => MeasureAngleTool.flyover,
      tooltip: () => MeasureAngleTool.description,
      execute: () => { IModelApp.tools.run(MeasureAngleTool.toolId); },
    });
  }

  public static get measurePerpendicularToolCommand() {
    return new ToolItemDef({
      toolId: MeasurePerpendicularTool.toolId,
      iconSpec: MeasurePerpendicularTool.iconSpec,
      label: () => MeasurePerpendicularTool.flyover,
      tooltip: () => MeasurePerpendicularTool.description,
      execute: () => { IModelApp.tools.run(MeasurePerpendicularTool.toolId); },
    });
  }
}
