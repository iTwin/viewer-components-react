/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import * as i18next from "i18next";
import { I18N } from "@bentley/imodeljs-i18n";
import { UiError, getClassName } from "@bentley/ui-abstract";

/**
 * Entry point for static initialization required by various components used in the package.
 * @public
 */
export class TreeWidget {
  private static _i18n?: I18N;
  private static _initialized: boolean;

  /**
   * Called by IModelApp to initialize the Tree Widget
   * @param i18n - The internationalization service created by the IModelApp.
   */
  public static async initialize(i18n: I18N): Promise<void> {
    if (this._initialized)
      return;

    this._initialized = true;
    TreeWidget._i18n = i18n;

    return TreeWidget._i18n.registerNamespace(TreeWidget.i18nNamespace)
      .readFinished;
  }

  /** Unregisters the TreeWidget internationalization service namespace */
  public static terminate() {
    if (TreeWidget._i18n)
      TreeWidget._i18n.unregisterNamespace(TreeWidget.i18nNamespace);
    TreeWidget._i18n = undefined;
  }

  /** The internationalization service created by the IModelApp. */
  public static get i18n(): I18N {
    if (!TreeWidget._i18n)
      throw new UiError(
        TreeWidget.loggerCategory(this),
        "TreeWidget not initialized"
      );
    return TreeWidget._i18n;
  }

  /** The internationalization service namespace. */
  public static get i18nNamespace(): string {
    return "TreeWidget";
  }

  public static get packageName(): string {
    return "tree-widget-react";
  }

  /** Calls i18n.translateWithNamespace with the "TreeWidget" namespace. Do NOT include the namespace in the key.
   */
  public static translate(
    key: string | string[],
    options?: i18next.TranslationOptions
  ): string {
    return TreeWidget.i18n.translateWithNamespace(
      TreeWidget.i18nNamespace,
      key,
      options
    );
  }

  public static loggerCategory(obj: any): string {
    const className = getClassName(obj);
    const category =
      TreeWidget.packageName + (className ? `.${className}` : "");
    return category;
  }
}
