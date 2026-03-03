/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { BentleyError, BentleyStatus, Logger } from "@itwin/core-bentley";
import { IModelApp } from "@itwin/core-frontend";
import { createLogger } from "@itwin/presentation-core-interop";
import { setLogger as setHierarchiesLogger } from "@itwin/presentation-hierarchies";
import { setLogger as setHierarchiesReactLogger } from "@itwin/presentation-hierarchies-react";

import type { Localization } from "@itwin/core-common";
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
  public static async initialize(_i18n?: Localization, logger?: ILogger): Promise<void> {
    if (this.#initialized) {
      return;
    }

    TreeWidget.#initialized = true;

    TreeWidget.#logger = logger ?? createLogger(Logger);
    setHierarchiesLogger(TreeWidget.#logger);
    setHierarchiesReactLogger(TreeWidget.#logger);
  }

  /** Unregisters the TreeWidget internationalization service namespace */
  public static terminate() {
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
}
