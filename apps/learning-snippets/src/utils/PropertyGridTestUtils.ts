/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
/* eslint-disable import/no-duplicates */
import { IModelApp, NoRenderApp } from "@itwin/core-frontend";
// __PUBLISH_EXTRACT_START__ PropertyGrid.PropertyGridManagerInitializeImports
import { PropertyGridManager } from "@itwin/property-grid-react";

// __PUBLISH_EXTRACT_END__

export class PropertyGridTestUtils {
  private static _initialized = false;

  public static async initialize() {
    if (PropertyGridTestUtils._initialized) {
      return;
    }

    await NoRenderApp.startup();
    // __PUBLISH_EXTRACT_START__ PropertyGrid.PropertyGridManagerInitialize
    await PropertyGridManager.initialize(IModelApp.localization);
    // __PUBLISH_EXTRACT_END__
    PropertyGridTestUtils._initialized = true;
  }

  public static async terminate() {
    PropertyGridManager.terminate();
    await IModelApp.shutdown();
    PropertyGridTestUtils._initialized = false;
  }
}
