/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import type { Localization, TranslationOptions } from "@itwin/core-common";
import { BentleyError, BentleyStatus } from "@itwin/core-bentley";
import { IModelApp } from "@itwin/core-frontend";

/**
 * Entry point for static initialization required by various components used in the package.
 * @public
 */
export class PropertyGridManager {
  private static _i18n?: Localization;
  private static _initialized?: boolean;

  /**
   * Called by IModelApp to initialize PropertyGridManager
   * @param i18n - The internationalization service created by the IModelApp.
   */
  public static async initialize(i18n?: Localization): Promise<void> {
    if (PropertyGridManager._initialized) {
      return;
    }

    PropertyGridManager._initialized = true;
    PropertyGridManager._i18n = i18n ?? IModelApp.localization;
    return PropertyGridManager._i18n.registerNamespace(PropertyGridManager.i18nNamespace);
  }

  /** Unregisters the PropertyGridManager internationalization service namespace */
  public static terminate() {
    if (PropertyGridManager._i18n) {
      PropertyGridManager._i18n.unregisterNamespace(PropertyGridManager.i18nNamespace); // eslint-disable-line @itwin/no-internal
    }
    PropertyGridManager._i18n = undefined;
    PropertyGridManager._initialized = false;
  }

  /** The internationalization service created by the IModelApp. */
  public static get i18n(): Localization {
    if (!PropertyGridManager._i18n) {
      throw new BentleyError(BentleyStatus.ERROR, "PropertyGridManager not initialized");
    }
    return PropertyGridManager._i18n;
  }

  /** The internationalization service namespace. */
  public static get i18nNamespace(): string {
    return "PropertyGrid";
  }

  /** Calls i18n.translateWithNamespace with the "PropertyGridManager" namespace. Do NOT include the namespace in the key.
   */
  public static translate(key: string, options?: TranslationOptions): string {
    return PropertyGridManager.i18n.getLocalizedString(`${PropertyGridManager.i18nNamespace}:${key}`, options);
  }
}
