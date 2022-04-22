/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { Localization } from "@itwin/core-common";
import { IModelApp } from "@itwin/core-frontend";

export class ReportsConfigWidget {
  private static _isInitialized = false;
  private static _i18nNamespace: any;
  private static _i18n?: Localization;

  public static get i18nNamespace(): any {
    return ReportsConfigWidget._i18nNamespace;
  }

  public static get isInitialized(): boolean {
    return ReportsConfigWidget._isInitialized;
  }
  public static async initialize(localization?: Localization): Promise<void> {
    if (ReportsConfigWidget.isInitialized)
      return;

    ReportsConfigWidget._isInitialized = true;
    ReportsConfigWidget._i18n = localization;
    // Setup i18n
    const ReportsWidgetNamespace = "ReportsConfigWidget";
    if (ReportsConfigWidget._i18n) {
      await ReportsConfigWidget._i18n.registerNamespace(ReportsWidgetNamespace);
    }
    else {
      await IModelApp.localization.registerNamespace(ReportsWidgetNamespace);
    }

    ReportsConfigWidget._i18nNamespace = ReportsWidgetNamespace;
  }

  public static terminate() {
    if (ReportsConfigWidget._i18n)
      ReportsConfigWidget._i18n.unregisterNamespace(ReportsConfigWidget.i18nNamespace);
    ReportsConfigWidget._i18n = undefined;
  }
}
