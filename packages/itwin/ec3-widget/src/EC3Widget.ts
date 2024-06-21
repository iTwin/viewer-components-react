/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
import type { Localization, TranslationOptions } from "@itwin/core-common";
import { IModelApp } from "@itwin/core-frontend";

export interface EC3WidgetConfig {
  // Provide custom localized strings to override default localized strings. Corresponding keys can be found in EC3Widget.json
  overRiddenStrings?: Map<string, string>;
  localization?: Localization;
}

/** EC3Widget is use when the package is used as a dependency to another app.
 * '''ts
 *  await EC3Widget.initialize({...EC3WidgetConfigProps});
 * '''
 * @beta
 */
export class EC3Widget {
  private static _defaultNs = "EC3Widget";
  public static localization: Localization;
  private static localizationOverrides?: Map<string, string>;

  /** Used to initialize the EC3Widget */
  public static async initialize(config?: EC3WidgetConfig): Promise<void> {
    // register namespace containing localized strings for this package
    EC3Widget.localization = config?.localization ?? IModelApp.localization;
    EC3Widget.localizationOverrides = config?.overRiddenStrings;
    await EC3Widget.localization.registerNamespace(EC3Widget.localizationNamespace);
  }

  /** Unregisters internationalization service namespace and UiItemManager  */
  public static terminate() {
    IModelApp.localization.unregisterNamespace(EC3Widget.localizationNamespace);
  }

  /** The internationalization service namespace. */
  public static get localizationNamespace(): string {
    return EC3Widget._defaultNs;
  }

  public static translate(key: string, options?: TranslationOptions): string {
    const stringKey = `${this.localizationNamespace}.${key}`;
    return this.localizationOverrides?.get(key) ?? EC3Widget.localization.getLocalizedString(stringKey, { ...options, ns: EC3Widget._defaultNs });
  }
}
