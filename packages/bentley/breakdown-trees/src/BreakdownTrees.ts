/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

/** @module Common */

import { getClassName, UiError } from "@itwin/appui-abstract";
import { Localization } from "@itwin/core-common";
import { LocalizationOptions } from "@itwin/core-i18n";

/**
 * Entry point for static initialization required by various
 * components used in the package.
 * @public
 */
export class BreakdownTrees {

  private static _i18n?: Localization;

  /**
   * Called by IModelApp to initialize the BreakdownTrees
   * @param localization The internationalization service created by the IModelApp.
   */
  public static async initialize(localization: Localization): Promise<void> {
    BreakdownTrees._i18n = localization;
    await BreakdownTrees._i18n.registerNamespace(BreakdownTrees.i18nNamespace);
    return Promise.resolve();
  }

  /** Unregisters the BreakdownTrees internationalization service namespace */
  public static terminate() {
    if (BreakdownTrees._i18n)
      BreakdownTrees._i18n.unregisterNamespace(BreakdownTrees.i18nNamespace);
    BreakdownTrees._i18n = undefined;
  }

  /** The internationalization service created by the IModelApp. */
  public static get i18n(): Localization {
    if (!BreakdownTrees._i18n)
      throw new UiError(BreakdownTrees.loggerCategory(this), "BreakdownTrees not initialized");
    return BreakdownTrees._i18n;
  }

  /** The internationalization service namespace. */
  public static get i18nNamespace(): string {
    return "BreakdownTrees";
  }

  /** @internal */
  public static get packageName(): string {
    return "breakdown-trees-react";
  }

  /** Calls i18n.translateWithNamespace with the "BreakdownTrees" namespace. Do NOT include the namespace in the key.
   * @internal
   */
  public static translate(key: string | string[], options?: LocalizationOptions): string {
    return BreakdownTrees.i18n.getLocalizedStringWithNamespace(BreakdownTrees.i18nNamespace, key, options);
  }

  /** @internal */
  public static loggerCategory(obj: any): string {
    const className = getClassName(obj);
    const category = BreakdownTrees.packageName + (className ? `.${className}` : "");
    return category;
  }

}
