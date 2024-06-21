/* eslint-disable no-console */
/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
import type { Localization, TranslationOptions } from "@itwin/core-common";
import { IModelApp } from "@itwin/core-frontend";
import type { EC3LocalizationResult } from "./components/EC3/EC3Localization";

export interface EC3WidgetConfig {
  overRiddenStrings?: EC3LocalizationResult;
}

/** EC3Widget is use when the package is used as a dependency to another app.
 * '''ts
 *  await EC3Widget.initialize({...EC3WidgetConfigProps});
 * '''
 * @beta
 */
export class EC3Widget {
  private static _defaultNs = "ec3Widget";
  public static localization: Localization;
  private static overridenStrings?: EC3LocalizationResult;

  /** Used to initialize the EC3Widget */
  public static async initialize(config?: EC3WidgetConfig): Promise<void> {
    // register namespace containing localized strings for this package
    EC3Widget.localization = IModelApp.localization;
    EC3Widget.overridenStrings = config?.overRiddenStrings;
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

  public static translate(key: string | string[], options?: TranslationOptions): string {
    const stringKey = `${this.localizationNamespace}.${key}`;
    if (this.overridenStrings) {
      const keyIndex = Object.keys(this.overridenStrings).findIndex((k) => k === key);
      return keyIndex >= 0
        ? Object.values(this.overridenStrings)[keyIndex]
        : EC3Widget.localization.getLocalizedString(stringKey, { ...options, ns: EC3Widget._defaultNs });
    }
    return EC3Widget.localization.getLocalizedString(stringKey, { ...options, ns: EC3Widget._defaultNs });
  }
}
