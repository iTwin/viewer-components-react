/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import type { Viewport } from "@itwin/core-frontend";
import type { Feature } from "../api/FeatureTracking.js";
import { FeatureTracking, MeasureToolsFeatures } from "../api/FeatureTracking.js";
import { MeasurementPreferences } from "../api/MeasurementPreferences.js";
import { PrimitiveToolBase } from "../api/MeasurementTool.js";

export class ToggleDisplayMeasurementAxesTool extends PrimitiveToolBase {
  public static override toolId = "MeasureTools.ToggleDisplayMeasurementAxes";

  public static override get iconSpec(): string {
    if (MeasurementPreferences.current.displayMeasurementAxes)
      return "icon-measure-2d-hide";

    return "icon-measure-2d-show";
  }

  // Ignore built-in feature tracking on the tool, since we want to add a toggle state to the tracking so we will call it ourselves
  protected override get feature(): Feature | undefined {
    return undefined;
  }

  constructor() {
    super();
  }

  public override requireWriteableTarget(): boolean {
    return false;
  }

  public override isCompatibleViewport(
    _vp: Viewport | undefined,
    _isSelectedViewChange: boolean
  ): boolean {
    return true;
  }

  public override async onPostInstall(): Promise<void> {
    await super.onPostInstall();

    const isEnabled = !MeasurementPreferences.current.displayMeasurementAxes;
    MeasurementPreferences.current.displayMeasurementAxes = isEnabled;
    FeatureTracking.notifyToggledFeature(
      MeasureToolsFeatures.Tools_ToggleDisplayMeasurementAxes,
      isEnabled
    );

    await this.exitTool();
  }

  public async onRestartTool(): Promise<void> {
    const tool = new ToggleDisplayMeasurementAxesTool();
    if (await tool.run()) return;

    return this.exitTool();
  }
}
