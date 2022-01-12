/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { IModelApp } from "@itwin/core-frontend";
import { MeasureDistanceTool } from "./tools/MeasureDistanceTool";
import { MeasureAreaTool } from "./tools/MeasureAreaTool";
import { MeasureLocationTool } from "./tools/MeasureLocationTool";
import { ClearMeasurementsTool } from "./tools/ClearMeasurementsTool";
import { ToggleDisplayMeasurementAxesTool } from "./tools/ToggleDisplayMeasurementAxesTool";
import { MeasurementManager } from "./api/MeasurementManager";
import { MeasureRadiusTool } from "./tools/MeasureRadiusTool";
import { MeasureAngleTool } from "./tools/MeasureAngleTool";
import { MeasurePerpendicularTool } from "./tools/MeasurePerpendicularTool";

export interface FeatureFlags {
  enableDistanceTool?: boolean;
  enableAreaTool?: boolean;
  enableLocationTool?: boolean;
  enableRadiusTool?: boolean;
  enableAngleTool?: boolean;
  enablePerpendicularTool?: boolean;
  enableToggleDisplayAxesTool?: boolean;
}

export interface StartupOptions {
  featureFlags?: FeatureFlags;
}

export class MeasureTools {
  private static _isInitialized = false;
  private static _i18nNamespace: any;
  private static _featureFlags: FeatureFlags;

  public static get i18nNamespace(): any {
    return MeasureTools._i18nNamespace;
  }

  public static get isInitialized(): boolean {
    return MeasureTools._isInitialized;
  }

  public static get featureFlags(): FeatureFlags {
    return MeasureTools._featureFlags;
  }

  public static async startup(options?: StartupOptions): Promise<void> {
    if (MeasureTools.isInitialized)
      return;

    MeasureTools._isInitialized = true;

    // Setup tools and i18n
    const measureToolsNamespace = "MeasureTools";
    await IModelApp.localization.registerNamespace(measureToolsNamespace);

    const featureFlags = {
      enableDistanceTool: true,
      enableAreaTool: true,
      enableLocationTool: true,
      enableRadiusTool: true,
      enableAngleTool: true,
      enablePerpendicularTool: true,
      enableToggleDisplayAxesTool: true,
      ...options?.featureFlags,
    };

    if (featureFlags.enableDistanceTool) {
      IModelApp.tools.register(MeasureDistanceTool, measureToolsNamespace);
    }
    if (featureFlags.enableAreaTool) {
      IModelApp.tools.register(MeasureAreaTool, measureToolsNamespace);
    }
    if (featureFlags.enableLocationTool) {
      IModelApp.tools.register(MeasureLocationTool, measureToolsNamespace);
    }
    if (featureFlags.enableRadiusTool) {
      IModelApp.tools.register(MeasureRadiusTool, measureToolsNamespace);
    }
    if (featureFlags.enableAngleTool) {
      IModelApp.tools.register(MeasureAngleTool, measureToolsNamespace);
    }
    if (featureFlags.enablePerpendicularTool) {
      IModelApp.tools.register(MeasurePerpendicularTool, measureToolsNamespace);
    }
    if (featureFlags.enableToggleDisplayAxesTool) {
      IModelApp.tools.register(ToggleDisplayMeasurementAxesTool, measureToolsNamespace);
    }
    if (Object.values(featureFlags).some(Boolean)) {
      IModelApp.tools.register(ClearMeasurementsTool, measureToolsNamespace);
    }

    MeasureTools._i18nNamespace = measureToolsNamespace;
    MeasureTools._featureFlags = featureFlags;

    // Register measurement decoration
    MeasurementManager.instance.startDecorator();
  }
}
