/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { assert, BentleyError, BentleyStatus } from "@itwin/core-bentley";
import { IModelApp } from "@itwin/core-frontend";

import type { Localization, TranslationOptions } from "@itwin/core-common";

/**
 * Entry point for static initialization required by various components used in the package.
 * @public
 */
export class TreeWidget {
  static #i18n?: Localization;
  static #initialized?: boolean;

  /**
   * Called by IModelApp to initialize the Tree Widget
   * @param i18n - The internationalization service created by the IModelApp.
   */
  public static async initialize(i18n?: Localization): Promise<void> {
    if (this.#initialized) {
      return;
    }

    TreeWidget.#initialized = true;
    TreeWidget.#i18n = i18n ?? IModelApp.localization;
    return TreeWidget.#i18n.registerNamespace(TreeWidget.i18nNamespace);
  }

  /** Unregisters the TreeWidget internationalization service namespace */
  public static terminate() {
    if (TreeWidget.#i18n) {
      TreeWidget.#i18n.unregisterNamespace(TreeWidget.i18nNamespace);
      TreeWidget.#i18n = undefined;
    }

    TreeWidget.#initialized = false;
  }

  /** The internationalization service created by the IModelApp. */
  public static get i18n(): Localization {
    if (!TreeWidget.#i18n) {
      throw new BentleyError(BentleyStatus.ERROR, "TreeWidget not initialized");
    }
    return TreeWidget.#i18n;
  }

  /** The internationalization service namespace. */
  public static get i18nNamespace(): string {
    return "TreeWidget";
  }

  /** Calls i18n.translateWithNamespace with the "TreeWidget" namespace. Do NOT include the namespace in the key.
   */
  public static translate(key: string | string[], options?: TranslationOptions): string {
    assert(!Array.isArray(key));
    const stringKey = `${TreeWidget.i18nNamespace}:${key}`;
    return TreeWidget.i18n.getLocalizedString(stringKey, options);
  }
}
