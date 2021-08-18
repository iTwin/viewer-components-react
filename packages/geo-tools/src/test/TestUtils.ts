/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See COPYRIGHT.md in the repository root for full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { I18N } from "@bentley/imodeljs-i18n";
import { GeoTools } from "../GeoTools";

// cSpell:ignore buttongroup

/** @internal */
export class TestUtils {
  private static _i18n?: I18N;
  private static _uiComponentsInitialized = false;

  public static get i18n(): I18N {
    if (!TestUtils._i18n) {
      TestUtils._i18n = new I18N();
    }
    return TestUtils._i18n;
  }

  public static async initializeGeoTools() {
    if (!TestUtils._uiComponentsInitialized) {
      // This is required by our I18n module (specifically the i18next package).
      (global as any).XMLHttpRequest = require("xmlhttprequest").XMLHttpRequest; // eslint-disable-line @typescript-eslint/no-var-requires

      await GeoTools.initialize(TestUtils.i18n);
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
