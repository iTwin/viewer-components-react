/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import type { Localization } from "@itwin/core-common";
import { IModelApp } from "@itwin/core-frontend";

export class ReportsConfigWidget {
  private static _localizationNamespace: string;
  private static _localization?: Localization;

  public static get localizationNamespace(): string {
    return ReportsConfigWidget._localizationNamespace;
  }

  public static async initialize(localization?: Localization): Promise<void> {
    ReportsConfigWidget._localization = localization ?? IModelApp.localization;
    // Setup localization
    const ReportsWidgetNamespace = "ReportsConfigWidget";
    if (ReportsConfigWidget._localization) {
      await ReportsConfigWidget._localization.registerNamespace(ReportsWidgetNamespace);
    } else {
      await IModelApp.localization.registerNamespace(ReportsWidgetNamespace);
    }

    ReportsConfigWidget._localizationNamespace = ReportsWidgetNamespace;
  }

  public static terminate() {
    if (ReportsConfigWidget._localization)
      ReportsConfigWidget._localization.unregisterNamespace(ReportsConfigWidget.localizationNamespace);
    ReportsConfigWidget._localization = undefined;
  }
}
