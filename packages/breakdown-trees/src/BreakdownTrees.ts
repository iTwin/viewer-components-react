/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

/** @module Common */

import { I18N } from "@bentley/imodeljs-i18n";
import { getClassName, UiError } from "@bentley/ui-abstract";

/**
 * Entry point for static initialization required by various
 * components used in the package.
 * @public
 */
export class BreakdownTrees {

  private static _i18n?: I18N;

  /**
   * Called by IModelApp to initialize the BreakdownTrees
   * @param i18n The internationalization service created by the IModelApp.
   */
  public static async initialize(i18n: I18N): Promise<void> {
    BreakdownTrees._i18n = i18n;
    await BreakdownTrees._i18n.registerNamespace(BreakdownTrees.i18nNamespace).readFinished;
    return Promise.resolve();
  }

  /** Unregisters the BreakdownTrees internationalization service namespace */
  public static terminate() {
    if (BreakdownTrees._i18n)
      BreakdownTrees._i18n.unregisterNamespace(BreakdownTrees.i18nNamespace);
    BreakdownTrees._i18n = undefined;
  }

  /** The internationalization service created by the IModelApp. */
  public static get i18n(): I18N {
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
  public static translate(key: string | string[]): string {
    return BreakdownTrees.i18n.translateWithNamespace(BreakdownTrees.i18nNamespace, key);
  }

  /** @internal */
  public static loggerCategory(obj: any): string {
    const className = getClassName(obj);
    const category = BreakdownTrees.packageName + (className ? `.${className}` : "");
    return category;
  }

}
