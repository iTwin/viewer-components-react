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
import type { Localization } from "@itwin/core-common";
import { DrawingDataCache } from "./api/DrawingTypeDataCache";

export interface FeatureFlags {
  hideDistanceTool?: boolean;
  hideAreaTool?: boolean;
  hideLocationTool?: boolean;
  hideRadiusTool?: boolean;
  hideAngleTool?: boolean;
  hidePerpendicularTool?: boolean;
  hideToggleDisplayAxesTool?: boolean;
}

export interface StartupOptions {
  localization?: Localization;
  featureFlags?: FeatureFlags;
}

export class MeasureTools {
  private static _isInitialized = false;
  private static _i18nNamespace = "MeasureTools";
  private static _localization: Localization;
  private static _featureFlags?: FeatureFlags;

  public static get isInitialized(): boolean {
    return MeasureTools._isInitialized;
  }

  public static get localization(): Localization {
    return MeasureTools._localization;
  }

  public static get featureFlags(): FeatureFlags | undefined {
    return MeasureTools._featureFlags;
  }

  public static async startup(options?: StartupOptions): Promise<void> {
    if (MeasureTools.isInitialized) return;

    MeasureTools._localization =
      options?.localization ?? IModelApp.localization;
    await MeasureTools._localization.registerNamespace(
      MeasureTools._i18nNamespace
    );

    const { featureFlags } = options ?? {};
    MeasureTools._featureFlags = featureFlags;

    const toolsToRegister = [];
    if (!featureFlags?.hideDistanceTool) {
      toolsToRegister.push(MeasureDistanceTool);
    }
    if (!featureFlags?.hideDistanceTool) {
      toolsToRegister.push(MeasureDistanceTool);
    }
    if (!featureFlags?.hideAreaTool) {
      toolsToRegister.push(MeasureAreaTool);
    }
    if (!featureFlags?.hideLocationTool) {
      toolsToRegister.push(MeasureLocationTool);
    }
    if (!featureFlags?.hideRadiusTool) {
      toolsToRegister.push(MeasureRadiusTool);
    }
    if (!featureFlags?.hideAngleTool) {
      toolsToRegister.push(MeasureAngleTool);
    }
    if (!featureFlags?.hidePerpendicularTool) {
      toolsToRegister.push(MeasurePerpendicularTool);
    }
    if (!featureFlags?.hideToggleDisplayAxesTool) {
      toolsToRegister.push(ToggleDisplayMeasurementAxesTool);
    }
    if (toolsToRegister.length > 0) {
      toolsToRegister.push(ClearMeasurementsTool);
    }

    for (const tool of toolsToRegister) {
      tool.register(MeasureTools._i18nNamespace);
    }

    // Register measurement decoration
    MeasurementManager.instance.startDecorator();
    // Initialize the measurementDrawingDataCache
    DrawingDataCache.getInstance();
    MeasureTools._isInitialized = true;
  }
  /** Unregisters internationalization service namespace and UiItemManager  */
  public static terminate() {
    IModelApp.localization.unregisterNamespace(MeasureTools._i18nNamespace);
  }
}
