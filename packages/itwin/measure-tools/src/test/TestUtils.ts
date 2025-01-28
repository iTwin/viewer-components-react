/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { MeasureTools } from "../MeasureTools.js";

export class TestUtils {

  /** Waits until all async operations finish */
  public static async cleanup() {
    MeasureTools.terminate();
    return new Promise((resolve) => setTimeout(resolve));
  }
}
