/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
import type { Localization } from "@itwin/core-common";
import { IModelApp } from "@itwin/core-frontend";

/**
 * ReportsConfigWidget localization
 * @public
 */
export class ReportsConfigWidget {
  private static _localizationNamespace: string;
  private static _localization: Localization;

  public static get localizationNamespace(): string {
    return ReportsConfigWidget._localizationNamespace;
  }

  public static get localization(): Localization {
    return ReportsConfigWidget._localization;
  }

  public static async initialize(localization?: Localization): Promise<void> {
    ReportsConfigWidget._localization = localization ?? IModelApp.localization;
    // Setup localization
    const ReportsConfigWidgetNamespace = "ReportsConfigWidget";
    await ReportsConfigWidget._localization.registerNamespace(ReportsConfigWidgetNamespace);

    ReportsConfigWidget._localizationNamespace = ReportsConfigWidgetNamespace;
  }

  public static terminate() {
    ReportsConfigWidget._localization.unregisterNamespace(ReportsConfigWidget.localizationNamespace);
  }
}
