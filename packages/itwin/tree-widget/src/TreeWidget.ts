/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import type { Localization } from "@itwin/core-common";
import { BentleyError, BentleyStatus } from "@itwin/core-common";
import { IModelApp } from "@itwin/core-frontend";
import { registerRenderers } from "./components/trees/common/Utils";

import type { LocalizationOptions } from "@itwin/core-i18n";

/**
 * Entry point for static initialization required by various components used in the package.
 * @public
 */
export class TreeWidget {
  private static _i18n?: Localization;
  private static _initialized?: boolean;
  private static _dispose?: () => void;

  /**
   * Called by IModelApp to initialize the Tree Widget
   * @param i18n - The internationalization service created by the IModelApp.
   */
  public static async initialize(i18n?: Localization): Promise<void> {
    if (this._initialized) {
      return;
    }

    TreeWidget._initialized = true;
    TreeWidget._i18n = i18n ?? IModelApp.localization;
    TreeWidget._dispose = registerRenderers();
    return TreeWidget._i18n.registerNamespace(TreeWidget.i18nNamespace);
  }

  /** Unregisters the TreeWidget internationalization service namespace */
  public static terminate() {
    if (TreeWidget._i18n) {
      TreeWidget._i18n.unregisterNamespace(TreeWidget.i18nNamespace);
      TreeWidget._i18n = undefined;
    }

    if (TreeWidget._dispose) {
      TreeWidget._dispose();
      TreeWidget._dispose = undefined;
    }

    TreeWidget._initialized = false;
  }

  /** The internationalization service created by the IModelApp. */
  public static get i18n(): Localization {
    if (!TreeWidget._i18n) {
      throw new BentleyError(BentleyStatus.ERROR, "TreeWidget not initialized");
    }
    return TreeWidget._i18n;
  }

  /** The internationalization service namespace. */
  public static get i18nNamespace(): string {
    return "TreeWidget";
  }

  /** Calls i18n.translateWithNamespace with the "TreeWidget" namespace. Do NOT include the namespace in the key.
   */
  public static translate(key: string | string[], options?: LocalizationOptions): string {
    const stringKey = `${TreeWidget.i18nNamespace}:${key}`;
    return TreeWidget.i18n.getLocalizedString(stringKey, options);
  }
}
