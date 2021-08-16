/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/


import * as i18next from "i18next";

import { I18N } from "@bentley/imodeljs-i18n";
import { getClassName, UiError } from "@bentley/ui-abstract";
import { StateManager } from "@bentley/ui-framework";
import { PropertyGridManagerFeatureFlags } from "./types";

/**
 * Entry point for static initialization required by various components used in the package.
 * @public
 */
export class PropertyGridManager {
  private static _i18n?: I18N;

  /** Feature Flag object with default values */
  private static _featureFlags: PropertyGridManagerFeatureFlags = {
    enablePropertyGroupNesting: false,
  };
  /**
   * Called by IModelApp to initialize PropertyGridManager
   * @param i18n - The internationalization service created by the IModelApp.
   */
  public static async initialize(i18n: I18N, featureFlags?: PropertyGridManagerFeatureFlags): Promise<void> {
    if (!StateManager.isInitialized()) {
      throw new Error(
        "UiFramework's StateManager must be initialized for Property Grid to work properly as an extension",
      );
    }

    if (featureFlags) {
      PropertyGridManager.changeFlags(featureFlags);
    }

    PropertyGridManager._i18n = i18n;
    return PropertyGridManager._i18n.registerNamespace(
      PropertyGridManager.i18nNamespace,
    ).readFinished;
  }

  /** Unregisters the PropertyGridManager internationalization service namespace */
  public static terminate() {
    if (PropertyGridManager._i18n)
      PropertyGridManager._i18n.unregisterNamespace(
        PropertyGridManager.i18nNamespace,
      );
    PropertyGridManager._i18n = undefined;
  }

  /** The internationalization service created by the IModelApp. */
  public static get i18n(): I18N {
    if (!PropertyGridManager._i18n)
      throw new UiError(
        PropertyGridManager.loggerCategory(this),
        "PropertyGridManager not initialized",
      );
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
    options?: i18next.TranslationOptions,
  ): string {
    return PropertyGridManager.i18n.translateWithNamespace(
      PropertyGridManager.i18nNamespace,
      key,
      options,
    );
  }

  public static loggerCategory(obj: any): string {
    const className = getClassName(obj);
    const category =
      PropertyGridManager.packageName + (className ? `.${className}` : "");
    return category;
  }

  public static changeFlags(featureFlags: any) {
    PropertyGridManager._featureFlags = {
      ...PropertyGridManager._featureFlags,
      ...featureFlags,
    };
  }

  /** Return object that contains all feature flags */
  public static get flags() {
    return PropertyGridManager._featureFlags;
  }
}
