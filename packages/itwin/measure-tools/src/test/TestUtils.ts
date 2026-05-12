/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { SyncUiEventDispatcher } from "@itwin/appui-react";
import { IModelApp } from "@itwin/core-frontend";
import { MeasurementManager } from "../api/MeasurementManager.js";
import { MeasurementUIEvents } from "../api/MeasurementUIEvents.js";
import { MeasureTools } from "../MeasureTools.js";

export class TestUtils {

  /** Waits until all async operations finish */
  public static async cleanup() {
    MeasurementUIEvents.shouldClearMeasurementHandler = undefined;
    MeasurementUIEvents.showToggleMeasurementAxesHandler = undefined;

    MeasurementManager.instance.clear();
    MeasurementManager.instance.stopDecorator();

    // SyncUiEventDispatcher uses debounced window.setTimeout calls internally.
    // Clear any pending timers before jsdom tears down the global window.
    SyncUiEventDispatcher.setTimeoutPeriod(0);

    MeasureTools.terminate();
    await IModelApp.shutdown();
  }
}
