/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
import { I18N } from "@bentley/imodeljs-i18n";
import i18n from "../tests/mocks/i18n";

export class MarkupFrontstage {
  private static _i18n?: I18N;

  public static async initialize(i18n: I18N): Promise<void> {
    MarkupFrontstage._i18n = i18n;
  }

  public static terminate() {
    MarkupFrontstage._i18n = undefined;
  }

  public static get i18n(): I18N {
    if (!MarkupFrontstage._i18n) {
      throw new Error("IModelJs I18N not initialized");
    }
    return MarkupFrontstage._i18n;
  }

  public static get i18nNamespace(): string {
    return "MakrupFrontstage";
  }

  public static get packageName(): string {
    return "markup-frontstage-react";
  }

  public static translate(
    key: string | string[],
    options?: i18n.TranslationOptions
  ): string {
    return MarkupFrontstage.i18n.translateWithNamespace(
      MarkupFrontstage.i18nNamespace,
      key,
      options
    );
  }

  public static loggerCategory(obj: any): string {
    return obj.name;
  }
}
