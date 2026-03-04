/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { BentleyError, BentleyStatus, Logger } from "@itwin/core-bentley";
import { createLogger } from "@itwin/presentation-core-interop";
import { setLogger as setHierarchiesLogger } from "@itwin/presentation-hierarchies";
import { setLogger as setHierarchiesReactLogger } from "@itwin/presentation-hierarchies-react";

import type { ILogger } from "@itwin/presentation-shared";

/**
 * Entry point for static initialization required by various components used in the package.
 * @public
 */
export class TreeWidget {
  static #logger?: ILogger;
  static #initialized?: boolean;

  /**
   * Called by IModelApp to initialize the Tree Widget
   * @param logger - The logger to use for logging messages. Defaults to `Logger` from `@itwin/core-bentley`.
   */
  public static async initialize(logger?: ILogger): Promise<void> {
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
