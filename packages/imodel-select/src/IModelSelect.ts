/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @module Common */

import * as i18next from "i18next";
import { I18N } from "@bentley/imodeljs-i18n";
import { UiError, getClassName } from "@bentley/ui-abstract";

/**
 * Entry point for static initialization required by various components used in the package.
 * @public
 */
export class IModelSelect {
  private static _i18n?: I18N;

  /**
   * Called by IModelApp to initialize IModelSelect
   * @param i18n - The internationalization service created by the IModelApp.
   */
  public static async initialize(i18n: I18N): Promise<void> {
    IModelSelect._i18n = i18n;
    await IModelSelect._i18n.registerNamespace(IModelSelect.i18nNamespace)
      .readFinished;
    return Promise.resolve();
  }

  /** Unregisters the IModelSelect internationalization service namespace */
  public static terminate() {
    if (IModelSelect._i18n)
      IModelSelect._i18n.unregisterNamespace(IModelSelect.i18nNamespace);
    IModelSelect._i18n = undefined;
  }

  /** The internationalization service created by the IModelApp. */
  public static get i18n(): I18N {
    if (!IModelSelect._i18n)
      throw new UiError(IModelSelect.loggerCategory(this), "IModelSelect not initialized");
    return IModelSelect._i18n;
  }

  /** The internationalization service namespace. */
  public static get i18nNamespace(): string {
    return "IModelSelect";
  }

  public static get packageName(): string {
    return "imodel-select-react";
  }

  /** Calls i18n.translateWithNamespace with the "IModelSelect" namespace. Do NOT include the namespace in the key.
   */
  public static translate(
    key: string | string[],
    options?: i18next.TranslationOptions
  ): string {
    return IModelSelect.i18n.translateWithNamespace(IModelSelect.i18nNamespace, key, options);
  }

  public static loggerCategory(obj: any): string {
    const className = getClassName(obj);
    const category =
      IModelSelect.packageName + (className ? `.${className}` : "");
    return category;
  }
}
