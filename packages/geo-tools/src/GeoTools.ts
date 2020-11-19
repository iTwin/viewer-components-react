/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import * as i18next from "i18next";
import { I18N } from "@bentley/imodeljs-i18n";
import { getClassName, UiError } from "@bentley/ui-abstract";

/**
 * Entry point for static initialization required by various components used in the package.
 * @public
 */
export class GeoTools {
  private static _i18n?: I18N;

  /**
   * Called by IModelApp to initialize GeoTools
   * @param i18n - The internationalization service created by the IModelApp.
   */
  public static async initialize(i18n: I18N): Promise<void> {
    GeoTools._i18n = i18n;
    return GeoTools._i18n.registerNamespace(GeoTools.i18nNamespace).readFinished;
  }

  /** Unregisters the GeoTools internationalization service namespace */
  public static terminate() {
    if (GeoTools._i18n)
      GeoTools._i18n.unregisterNamespace(GeoTools.i18nNamespace);
    GeoTools._i18n = undefined;
  }

  /** The internationalization service created by the IModelApp. */
  public static get i18n(): I18N {
    if (!GeoTools._i18n)
      throw new UiError(GeoTools.loggerCategory(this), "GeoTools not initialized");
    return GeoTools._i18n;
  }

  /** The internationalization service namespace. */
  public static get i18nNamespace(): string {
    return "GeoTools";
  }

  public static get packageName(): string {
    return "geo-tools-react";
  }

  /** Calls i18n.translateWithNamespace with the "GeoTools" namespace. Do NOT include the namespace in the key.
   */
  public static translate(
    key: string | string[],
    options?: i18next.TranslationOptions
  ): string {
    return GeoTools.i18n.translateWithNamespace(GeoTools.i18nNamespace, key, options);
  }

  public static loggerCategory(obj: any): string {
    const className = getClassName(obj);
    const category =
      GeoTools.packageName + (className ? `.${className}` : "");
    return category;
  }
}
