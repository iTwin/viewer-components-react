/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { IModelApp } from "@itwin/core-frontend";

export class ReportsWidget {
  private static _isInitialized = false;
  private static _i18nNamespace: any;

  public static get i18nNamespace(): any {
    return ReportsWidget._i18nNamespace;
  }

  public static get isInitialized(): boolean {
    return ReportsWidget._isInitialized;
  }
  public static async startup(): Promise<void> {
    if (ReportsWidget.isInitialized)
      return;

    ReportsWidget._isInitialized = true;

    // Setup i18n
    const ReportsWidgetNamespace = "ReportsWidget";
    await IModelApp.localization.registerNamespace(ReportsWidgetNamespace);

    ReportsWidget._i18nNamespace = ReportsWidgetNamespace;
  }
}
