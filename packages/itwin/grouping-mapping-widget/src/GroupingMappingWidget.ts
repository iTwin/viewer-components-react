/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
import { BentleyError, BentleyStatus } from "@itwin/core-bentley";
import { IModelApp } from "@itwin/core-frontend";

import type { Localization, TranslationOptions } from "@itwin/core-common";

/** @public */
export interface GroupingMappingWidgetConfig {
  localization?: Localization;
  /** Override specific translation keys at runtime. Keys correspond to those in GroupingMappingWidget.json. */
  localizationOverrides?: Map<string, string>;
}

/**
 * Entry point for static initialization required by various components used in the package.
 * @public
 */
export class GroupingMappingWidget {
  static #i18n?: Localization;
  static #initialized?: boolean;
  static #localizationOverrides?: Map<string, string>;

  /**
   * Called to initialize the Grouping & Mapping Widget localization.
   * @param config - Optional configuration with custom localization service and overrides.
   */
  public static async initialize(config?: GroupingMappingWidgetConfig): Promise<void> {
    if (this.#initialized) {
      return;
    }

    GroupingMappingWidget.#initialized = true;
    GroupingMappingWidget.#i18n = config?.localization ?? IModelApp.localization;
    GroupingMappingWidget.#localizationOverrides = config?.localizationOverrides;
    return GroupingMappingWidget.#i18n.registerNamespace(GroupingMappingWidget.i18nNamespace);
  }

  /** Unregisters the GroupingMappingWidget internationalization service namespace */
  public static terminate() {
    if (GroupingMappingWidget.#i18n) {
      GroupingMappingWidget.#i18n.unregisterNamespace(GroupingMappingWidget.i18nNamespace);
      GroupingMappingWidget.#i18n = undefined;
    }

    GroupingMappingWidget.#initialized = false;
  }

  /** The internationalization service created by the IModelApp. */
  public static get i18n(): Localization {
    if (!GroupingMappingWidget.#i18n) {
      throw new BentleyError(BentleyStatus.ERROR, "GroupingMappingWidget not initialized");
    }
    return GroupingMappingWidget.#i18n;
  }

  /** The internationalization service namespace. */
  public static get i18nNamespace(): string {
    return "GroupingMappingWidget";
  }

  /** Calls i18n.getLocalizedString with the "GroupingMappingWidget" namespace. Do NOT include the namespace in the key. */
  public static translate(key: string | string[], options?: TranslationOptions): string {
    const keyStr = Array.isArray(key) ? key[0] : key;
    return (
      GroupingMappingWidget.#localizationOverrides?.get(keyStr) ??
      GroupingMappingWidget.i18n.getLocalizedString(
        `${GroupingMappingWidget.i18nNamespace}:${key}`,
        options
      )
    );
  }
}
