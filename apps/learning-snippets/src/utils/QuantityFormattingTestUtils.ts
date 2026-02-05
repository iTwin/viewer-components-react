/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
 
import { IModelApp, NoRenderApp } from "@itwin/core-frontend";
// __PUBLISH_EXTRACT_START__ QuantityFormat.QuantityFormattingInitializeImports
import { QuantityFormatting } from "@itwin/quantity-formatting-react";

// __PUBLISH_EXTRACT_END__

export class QuantityFormattingTestUtils {
  private static _initialized = false;

  public static async initialize() {
    if (QuantityFormattingTestUtils._initialized) {
      return;
    }

    await NoRenderApp.startup();
    // __PUBLISH_EXTRACT_START__ QuantityFormat.QuantityFormattingInitialize
    await QuantityFormatting.startup({ localization: IModelApp.localization });
    // __PUBLISH_EXTRACT_END__
    QuantityFormattingTestUtils._initialized = true;
  }

  public static async terminate() {
    QuantityFormatting.terminate();
    await IModelApp.shutdown();
    QuantityFormattingTestUtils._initialized = false;
  }
}
