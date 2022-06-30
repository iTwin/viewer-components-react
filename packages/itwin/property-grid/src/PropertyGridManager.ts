/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { getClassName, UiError } from "@itwin/appui-abstract";
import { IModelApp } from "@itwin/core-frontend";
import type { Localization } from "@itwin/core-common";
import type { LocalizationOptions } from "@itwin/core-i18n";

/** Supported Feature Flags for  */
export interface PropertyGridFeatureFlags {
  /** If true, enable up/down ancestor navigation */
  enableAncestorNavigation?: boolean;
}

/**
 * Entry point for static initialization required by various components used in the package.
 * @public
 */
export class PropertyGridManager {
  private static _i18n?: Localization;
  private static _initialized?: boolean;
  /** Make sure all supported flags are initialize here */
  private static _featureFlags: PropertyGridFeatureFlags = {};

  /**
   * Called by IModelApp to initialize PropertyGridManager
   * @param i18n - The internationalization service created by the IModelApp.
   */
  public static async initialize(
    i18n?: Localization,
    featureFlags?: PropertyGridFeatureFlags,
  ): Promise<void> {
    if (this._initialized) return;

    this._initialized = true;
    this._featureFlags = {...featureFlags};
    PropertyGridManager._i18n = i18n ?? IModelApp.localization;
    return PropertyGridManager._i18n.registerNamespace(
      PropertyGridManager.i18nNamespace
    );
  }

  /** Unregisters the PropertyGridManager internationalization service namespace */
  public static terminate() {
    if (PropertyGridManager._i18n) {
      PropertyGridManager._i18n.unregisterNamespace(
        PropertyGridManager.i18nNamespace
      );
    }
    PropertyGridManager._i18n = undefined;
  }

  /** Return object that contains all feature flags */
  public static get flags() {
    return PropertyGridManager._featureFlags;
  }

  /** The internationalization service created by the IModelApp. */
  public static get i18n(): Localization {
    if (!PropertyGridManager._i18n) {
      throw new UiError(
        PropertyGridManager.loggerCategory(this),
        "PropertyGridManager not initialized"
      );
    }
    return PropertyGridManager._i18n;
  }

  /** The internationalization service namespace. */
  public static get i18nNamespace(): string {
    return "PropertyGrid";
  }

  public static get packageName(): string {
    return "property-grid-react";
  }

  /** Calls i18n.translateWithNamespace with the "PropertyGridManager" namespace. Do NOT include the namespace in the key.
   */
  public static translate(
    key: string | string[],
    options?: LocalizationOptions
  ): string {
    return PropertyGridManager.i18n.getLocalizedStringWithNamespace(
      PropertyGridManager.i18nNamespace,
      key,
      options
    );
  }

  public static loggerCategory(obj: any): string {
    const className = getClassName(obj);
    const category =
      PropertyGridManager.packageName + (className ? `.${className}` : "");
    return category;
  }
}
