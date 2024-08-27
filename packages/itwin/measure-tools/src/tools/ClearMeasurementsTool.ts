/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import type { Viewport } from "@itwin/core-frontend";
import { MeasurementManager } from "../api/MeasurementManager";
import { MeasurementUIEvents } from "../api/MeasurementUIEvents";
import type { Measurement } from "../api/Measurement";
import { PrimitiveToolBase } from "../api/MeasurementTool";
import type { Feature } from "../api/FeatureTracking";
import { MeasureToolsFeatures } from "../api/FeatureTracking";
import { MeasureTools } from "../MeasureTools";

export class ClearMeasurementsTool extends PrimitiveToolBase {
  public static override toolId = "MeasureTools.ClearMeasurements";
  public static override iconSpec = "icon-measure-clear";

  public static override get flyover() {
    return MeasureTools.localization.getLocalizedString(
      "MeasureTools:tools.ClearMeasurements.flyover"
    );
  }
  public static override get description(): string {
    return MeasureTools.localization.getLocalizedString(
      "MeasureTools:tools.ClearMeasurements.description",
    );
  }
  public static override get keyin(): string {
    return MeasureTools.localization.getLocalizedString(
      "MeasureTools:tools.ClearMeasurements.keyin",
    );
  }

  protected override get feature(): Feature | undefined {
    return MeasureToolsFeatures.Tools_ClearMeasurements;
  }

  constructor(onFeatureUsed?: (feature: string) => void) {
    super(onFeatureUsed);
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
    this.handleFeature("feature-clear-measurements-event-trigger");
    // NOTE: If we were laying out measurements in a tool, by virtue of how tools run, those measurements will have persisted by the time
    // we install this clear tool

    // Default behavior is to clear non-locked measurements. The user can override this with setting a handler
    const overrideClearHandler =
      MeasurementUIEvents.shouldClearMeasurementHandler;
    if (overrideClearHandler) {
      MeasurementManager.instance.dropMeasurementsForPredicate(
        (measurement: Measurement) => {
          return overrideClearHandler(measurement);
        }
      );
    } else {
      MeasurementManager.instance.clear(false);
    }

    await this.exitTool();
  }

  public async onRestartTool(): Promise<void> {
    const tool = new ClearMeasurementsTool();
    if (await tool.run()) return;

    return this.exitTool();
  }
}
