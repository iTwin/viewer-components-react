/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
/* eslint-disable import/no-duplicates */
import { IModelHost } from "@itwin/core-backend";
import { NoRenderApp } from "@itwin/core-frontend";
// __PUBLISH_EXTRACT_START__ PropertyGrid.PropertyGridManagerInitializeImports
import { PropertyGridManager } from "@itwin/property-grid-react";
import { IModelApp } from "@itwin/core-frontend";
// __PUBLISH_EXTRACT_END__

export class PropertyGridTestUtils {
  private static _initialized = false;

  public static async initialize() {
    if (PropertyGridTestUtils._initialized) {
      return;
    }

    await IModelHost.startup();
    await NoRenderApp.startup();
    // __PUBLISH_EXTRACT_START__ PropertyGrid.PropertyGridManagerInitialize
    await PropertyGridManager.initialize(IModelApp.localization);
    // __PUBLISH_EXTRACT_END__
    PropertyGridTestUtils._initialized = true;
  }

  public static async terminate() {
    PropertyGridManager.terminate();
    await IModelApp.shutdown();
    await IModelHost.shutdown();
    PropertyGridTestUtils._initialized = false;
  }
}
