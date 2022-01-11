/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { Viewport } from "@itwin/core-frontend";
import { MeasurementManager } from "../api/MeasurementManager";
import { MeasurementUIEvents } from "../api/MeasurementUIEvents";
import { Measurement } from "../api/Measurement";
import { PrimitiveToolBase} from "../api/MeasurementTool";
import { Feature, MeasureToolsFeatures } from "../api/FeatureTracking";

export class ClearMeasurementsTool extends PrimitiveToolBase {
  public static override toolId = "ClearMeasurements";
  public static override iconSpec = "icon-measure-clear";

  protected override get feature(): Feature | undefined { return MeasureToolsFeatures.Tools_ClearMeasurements; }

  constructor() {
    super();
  }

  public override requireWriteableTarget(): boolean {
    return false;
  }

  public override isCompatibleViewport(_vp: Viewport | undefined, _isSelectedViewChange: boolean): boolean {
    return true;
  }

  public override async onPostInstall(): Promise<void> {
    await super.onPostInstall();

    // NOTE: If we were laying out measurements in a tool, by virtue of how tools run, those measurements will have persisted by the time
    // we install this clear tool

    // Default behavior is to clear non-locked measurements. The user can override this with setting a handler
    const overrideClearHandler = MeasurementUIEvents.shouldClearMeasurementHandler;
    if (overrideClearHandler) {
      MeasurementManager.instance.dropMeasurementsForPredicate((measurement: Measurement) => {
        return overrideClearHandler(measurement);
      });
    } else {
      MeasurementManager.instance.clear(false);
    }

    await this.exitTool();
  }

  public async onRestartTool(): Promise<void> {
    const tool = new ClearMeasurementsTool();
    if (await tool.run())
      return;

    return this.exitTool();
  }
}
