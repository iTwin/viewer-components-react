/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
import type { Localization, TranslationOptions } from "@itwin/core-common";
import { IModelApp } from "@itwin/core-frontend";

export interface EC3WidgetConfig {
  localization?: Localization;
}

/** EC3WidgetUI is use when the package is used as a dependency to another app.
 * '''ts
 *  await EC3WidgetUI.initialize({...EC3WidgetConfigProps});
 * '''
 * @beta
 */
export class EC3WidgetUI {
  private static _defaultNs = "ec3Widget";
  public static localization: Localization;

  /** Used to initialize the EC3WidgetUI */
  public static async initialize(config?: EC3WidgetConfig): Promise<void> {
    // register namespace containing localized strings for this package
    EC3WidgetUI.localization = config?.localization ?? IModelApp.localization;
    await EC3WidgetUI.localization.registerNamespace(EC3WidgetUI.localizationNamespace);
  }

  /** Unregisters internationalization service namespace and UiItemManager  */
  public static terminate() {
    IModelApp.localization.unregisterNamespace(EC3WidgetUI.localizationNamespace);
  }

  /** The internationalization service namespace. */
  public static get localizationNamespace(): string {
    return EC3WidgetUI._defaultNs;
  }

  public static translate(key: string | string[], options?: TranslationOptions): string {
    return EC3WidgetUI.localization.getLocalizedString(key, { ...options, ns: EC3WidgetUI._defaultNs });
  }
}
