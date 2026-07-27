/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import type { Localization } from "@itwin/core-common";
import { IModelApp } from "@itwin/core-frontend";
import { GeoTools } from "../GeoTools";

// cSpell:ignore buttongroup

/** @internal */
export class TestUtils {
  private static _localization: Localization;
  private static _uiComponentsInitialized = false;

  public static get localization(): Localization {
    if (!TestUtils._localization) {
      TestUtils._localization = IModelApp.localization;
    }
    return TestUtils._localization;
  }

  public static async initializeGeoTools() {
    if (!TestUtils._uiComponentsInitialized) {
      // This is required by our I18n module (specifically the i18next package).
      (global as any).XMLHttpRequest = require("xmlhttprequest").XMLHttpRequest;

      await GeoTools.initialize(TestUtils.localization);
      TestUtils._uiComponentsInitialized = true;
    }
  }

  public static terminateUiComponents() {
    GeoTools.terminate();
    TestUtils._uiComponentsInitialized = false;
  }

  /** Waits until all async operations finish */
  public static async flushAsyncOperations() {
    return new Promise((resolve) => setTimeout(resolve));
  }

}
export default TestUtils;   // eslint-disable-line: no-default-export
