/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @module Common */
import { I18N } from "@bentley/imodeljs-i18n";
import { UiError, getClassName } from "@bentley/ui-abstract";
import * as i18next from "i18next";

/**
 * Entry point for static initialization required by various components used in the package.
 * @public
 */
export class MarkupFrontstage {
  private static _i18n?: I18N;

  /**
   * Called by IModelApp to initiazlize MarkupFrontstage
   * @param i18n The name of internationalization service created by IModelAppp.
   */
  public static async initialize(i18n: I18N): Promise<void> {
    MarkupFrontstage._i18n = i18n;
    return MarkupFrontstage._i18n.registerNamespace(
      MarkupFrontstage.i18nNamespace
    ).readFinished;
  }
  /**
   * Unregisters the MakrupFrontstage internationalization service namespace.
   */
  public static terminate() {
    if (MarkupFrontstage._i18n) {
      MarkupFrontstage._i18n.unregisterNamespace(
        MarkupFrontstage.i18nNamespace
      );
    }
    MarkupFrontstage._i18n = undefined;
  }

  public static get i18n(): I18N {
    if (!MarkupFrontstage._i18n) {
      throw new UiError(
        MarkupFrontstage.loggerCategory(this),
        "MarkupFrontstage not initialized"
      );
    }
    return MarkupFrontstage._i18n;
  }

  /**
   * The internationazlization service namespace.
   */
  public static get i18nNamespace(): string {
    return "MakrupFrontstage";
  }

  public static get packageName(): string {
    return "markup-frontstage-react";
  }

  public static translate(
    key: string | string[],
    options?: i18next.TranslationOptions
  ): string {
    return MarkupFrontstage.i18n.translateWithNamespace(
      MarkupFrontstage.i18nNamespace,
      key,
      options
    );
  }

  public static loggerCategory(obj: any): string {
    const className = getClassName(obj);
    const category =
      MarkupFrontstage.packageName + (className ? `.${className}` : "");
    return category;
  }
}
