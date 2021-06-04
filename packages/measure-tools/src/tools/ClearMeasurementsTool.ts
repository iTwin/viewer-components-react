/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { Viewport } from "@bentley/imodeljs-frontend";
import { MeasurementManager } from "../api/MeasurementManager";
import { MeasurementUIEvents } from "../api/MeasurementUIEvents";
import { Measurement } from "../api/Measurement";
import { PrimitiveToolBase} from "../api/MeasurementTool";
import { Feature, MeasureToolsFeatures } from "../api/FeatureTracking";

export class ClearMeasurementsTool extends PrimitiveToolBase {
  public static toolId = "ClearMeasurements";
  public static iconSpec = "icon-measure-clear";

  protected get feature(): Feature | undefined { return MeasureToolsFeatures.Tools_ClearMeasurements; }

  constructor() {
    super();
  }

  public requireWriteableTarget(): boolean {
    return false;
  }

  public isCompatibleViewport(_vp: Viewport | undefined, _isSelectedViewChange: boolean): boolean {
    return true;
  }

  public onPostInstall() {
    super.onPostInstall();

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

    this.exitTool();
  }

  public onRestartTool(): void {
    const tool = new ClearMeasurementsTool();
    if (!tool.run())
      this.exitTool();
  }
}
