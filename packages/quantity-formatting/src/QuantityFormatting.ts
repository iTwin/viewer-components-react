/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { IModelApp } from "@itwin/core-frontend";
import type { Localization } from "@itwin/core-common";

/**
 * Logger category for quantity formatting
 * @beta
 */
export const QuantityFormattingLoggerCategory = "QuantityFormat"

/**
 * Static class for managing quantity formatting localization and initialization.
 * This class handles the setup and management of internationalization resources
 * for quantity formatting components.
 * @beta
 */
export class QuantityFormatting {
  private static _isInitialized = false;
  private static _startupPromise: Promise<void> | undefined;
  private static _i18nNamespace = "QuantityFormat";
  private static _localization: Localization | undefined;

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
    if (!QuantityFormatting._localization)
      throw new Error("QuantityFormatting.startup() must be called before rendering quantity formatting components.");
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
    // Share one in-flight startup so concurrent callers don't register the namespace twice.
    QuantityFormatting._startupPromise ??= QuantityFormatting.initialize(options?.localization ?? IModelApp.localization).catch((error) => {
      QuantityFormatting._startupPromise = undefined;
      QuantityFormatting._localization = undefined;
      throw error;
    });
    return QuantityFormatting._startupPromise;
  }

  private static async initialize(localization: Localization): Promise<void> {
    // Assigned before awaiting so components rendered while the namespace loads keep working.
    QuantityFormatting._localization = localization;
    await localization.registerNamespace(QuantityFormatting._i18nNamespace);
    QuantityFormatting._isInitialized = true;
  }

  /**
   * Terminates the QuantityFormatting class and unregisters the localization namespace.
   */
  public static terminate(): void {
    if (QuantityFormatting._isInitialized) {
      QuantityFormatting._localization?.unregisterNamespace(QuantityFormatting._i18nNamespace);
      QuantityFormatting._localization = undefined;
      QuantityFormatting._isInitialized = false;
    }
    QuantityFormatting._startupPromise = undefined;
  }
}
