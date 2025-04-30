/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { BentleyError, BentleyStatus, Logger } from "@itwin/core-bentley";
import { IModelApp } from "@itwin/core-frontend";
import { createLogger } from "@itwin/presentation-core-interop";
import { setLogger as setHierarchiesLogger } from "@itwin/presentation-hierarchies";
import { setLogger as setHierarchiesReactLogger } from "@itwin/presentation-hierarchies-react";

import type { Localization, TranslationOptions } from "@itwin/core-common";
import type { ILogger } from "@itwin/presentation-shared";

/**
 * Entry point for static initialization required by various components used in the package.
 * @public
 */
export class TreeWidget {
  private static _i18n?: Localization;
  private static _logger?: ILogger;
  private static _initialized?: boolean;

  /**
   * Called by IModelApp to initialize the Tree Widget
   * @param i18n - The internationalization service created by the IModelApp.
   * @param logger - The logger to use for logging messages. Defaults to `Logger` from `@itwin/core-bentley`.
   */
  public static async initialize(i18n?: Localization, logger?: ILogger): Promise<void> {
    if (this._initialized) {
      return;
    }

    TreeWidget._initialized = true;

    TreeWidget._logger = logger ?? createLogger(Logger);
    setHierarchiesLogger(TreeWidget._logger);
    setHierarchiesReactLogger(TreeWidget._logger);

    TreeWidget._i18n = i18n ?? IModelApp.localization;
    return TreeWidget._i18n.registerNamespace(TreeWidget.i18nNamespace);
  }

  /** Unregisters the TreeWidget internationalization service namespace */
  public static terminate() {
    if (TreeWidget._i18n) {
      TreeWidget._i18n.unregisterNamespace(TreeWidget.i18nNamespace);
      TreeWidget._i18n = undefined;
    }

    TreeWidget._logger = undefined;
    setHierarchiesLogger(undefined);
    setHierarchiesReactLogger(undefined);

    TreeWidget._initialized = false;
  }

  /** The logger used by this components in this package. */
  public static get logger(): ILogger {
    if (!TreeWidget._logger) {
      throw new BentleyError(BentleyStatus.ERROR, "TreeWidget not initialized");
    }
    return TreeWidget._logger;
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
  public static translate(key: string | string[], options?: TranslationOptions): string {
    const stringKey = `${TreeWidget.i18nNamespace}:${key}`;
    return TreeWidget.i18n.getLocalizedString(stringKey, options);
  }
}
