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
  static #i18n?: Localization;
  static #logger?: ILogger;
  static #initialized?: boolean;

  /**
   * Called by IModelApp to initialize the Tree Widget
   * @param i18n - The internationalization service created by the IModelApp.
   * @param logger - The logger to use for logging messages. Defaults to `Logger` from `@itwin/core-bentley`.
   */
  public static async initialize(i18n?: Localization, logger?: ILogger): Promise<void> {
    if (this.#initialized) {
      return;
    }

    TreeWidget.#initialized = true;

    TreeWidget.#logger = logger ?? createLogger(Logger);
    setHierarchiesLogger(TreeWidget.#logger);
    setHierarchiesReactLogger(TreeWidget.#logger);

    TreeWidget.#i18n = i18n ?? IModelApp.localization;
    return TreeWidget.#i18n.registerNamespace(TreeWidget.i18nNamespace);
  }

  /** Unregisters the TreeWidget internationalization service namespace */
  public static terminate() {
    if (TreeWidget.#i18n) {
      TreeWidget.#i18n.unregisterNamespace(TreeWidget.i18nNamespace);
      TreeWidget.#i18n = undefined;
    }

    TreeWidget.#logger = undefined;
    setHierarchiesLogger(undefined);
    setHierarchiesReactLogger(undefined);

    TreeWidget.#initialized = false;
  }

  /** The logger used by this components in this package. */
  public static get logger(): ILogger {
    if (!TreeWidget.#logger) {
      throw new BentleyError(BentleyStatus.ERROR, "TreeWidget not initialized");
    }
    return TreeWidget.#logger;
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
  public static translate(key: string, options?: TranslationOptions): string {
    const stringKey = `${TreeWidget.i18nNamespace}:${key}`;
    return TreeWidget.i18n.getLocalizedString(stringKey, options);
  }
}
