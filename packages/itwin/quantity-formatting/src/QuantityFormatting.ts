/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { IModelApp } from "@itwin/core-frontend";
import type { Localization } from "@itwin/core-common";

/**
 * Logger categories for quantity formatting
 * @beta
 */
export enum QuantityFormattingLoggerCategory {
  Frontend = "QuantityFormat.Frontend",
}

/**
 * Static class for managing quantity formatting localization and initialization.
 * This class handles the setup and management of internationalization resources
 * for quantity formatting components.
 * @beta
 */
export class QuantityFormatting {
  private static _isInitialized = false;
  private static _i18nNamespace = "QuantityFormat";
  private static _localization: Localization;

  /**
   * Returns true if the QuantityFormatting class has been initialized.
   */
  public static get isInitialized(): boolean {
    return QuantityFormatting._isInitialized;
  }

  /**
   * Returns the localization instance used by quantity formatting components.
   */
  public static get localization(): Localization {
    return QuantityFormatting._localization;
  }

  /**
   * Returns the internationalization namespace used by quantity formatting components.
   */
  public static get i18nNamespace(): string {
    return QuantityFormatting._i18nNamespace;
  }

  /**
   * Initializes the QuantityFormatting class with localization support.
   * @param options Optional startup options including custom localization instance
   */
  public static async startup(options?: { localization?: Localization }): Promise<void> {
    if (QuantityFormatting.isInitialized) return;

    QuantityFormatting._localization =
      options?.localization ?? IModelApp.localization;
    await QuantityFormatting._localization.registerNamespace(
      QuantityFormatting._i18nNamespace
    );

    QuantityFormatting._isInitialized = true;
  }

  /**
   * Terminates the QuantityFormatting class and unregisters the localization namespace.
   */
  public static terminate(): void {
    if (QuantityFormatting._isInitialized) {
      QuantityFormatting._localization.unregisterNamespace(QuantityFormatting._i18nNamespace)
      QuantityFormatting._isInitialized = false;
    }
  }
}
