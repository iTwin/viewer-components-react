/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * Licensed under the MIT License. See LICENSE.md in the project root for license terms.
 *--------------------------------------------------------------------------------------------*/

import * as i18next from "i18next";

import { I18N, I18NNamespace } from "@bentley/imodeljs-i18n";
import {
  getClassName,
  UiError,
  UiItemsManager,
} from "@bentley/ui-abstract";
import { Extension, IModelApp } from "@bentley/imodeljs-frontend";
import { PropertyGridUiItemsProvider } from "./components/PropertyGridUiItemsProvider";

/**
 * Entry point for static initialization required by various components used in the package.
 * @public
 */
export class PropertyGridManager {
  private static _i18n?: I18N;

  /**
   * Called by IModelApp to initialize PropertyGridManager
   * @param i18n - The internationalization service created by the IModelApp.
   */
  public static async initialize(i18n: I18N): Promise<void> {
    PropertyGridManager._i18n = i18n;
    return PropertyGridManager._i18n.registerNamespace(
      PropertyGridManager.i18nNamespace,
    ).readFinished;
  }

  /** Unregisters the PropertyGridManager internationalization service namespace */
  public static terminate() {
    if (PropertyGridManager._i18n)
      PropertyGridManager._i18n.unregisterNamespace(
        PropertyGridManager.i18nNamespace,
      );
    PropertyGridManager._i18n = undefined;
  }

  /** The internationalization service created by the IModelApp. */
  public static get i18n(): I18N {
    if (!PropertyGridManager._i18n)
      throw new UiError(
        PropertyGridManager.loggerCategory(this),
        "PropertyGridManager not initialized",
      );
    return PropertyGridManager._i18n;
  }

  /** The internationalization service namespace. */
  public static get i18nNamespace(): string {
    return "PropertyGrid";
  }

  public static get packageName(): string {
    return "property-grid-react";
  }

  /** Calls i18n.translateWithNamespace with the "PropertyGridManager" namespace. Do NOT include the namespace in the key.
   */
  public static translate(
    key: string | string[],
    options?: i18next.TranslationOptions,
  ): string {
    return PropertyGridManager.i18n.translateWithNamespace(
      PropertyGridManager.i18nNamespace,
      key,
      options,
    );
  }

  public static loggerCategory(obj: any): string {
    const className = getClassName(obj);
    const category =
      PropertyGridManager.packageName + (className ? `.${className}` : "");
    return category;
  }
}

/** Extension object for loading on runtime */
class PropertyGridExtension extends Extension {
  protected _defaultNs = "PropertyGrid";
  private _i18NNamespace?: I18NNamespace;

  public async onExecute(_args: string[]): Promise<void> {
    // No-op
  }

  public async onLoad(_args: string[]): Promise<void> {
    // TODO:
    // Register namespace
    this._i18NNamespace = this.i18n.getNamespace(
      PropertyGridManager.i18nNamespace,
    );
    if (this._i18NNamespace === undefined) {
      throw new Error("Property grid extension could not find locale");
    }
    await this._i18NNamespace.readFinished;
    await PropertyGridManager.initialize(this.i18n);
    UiItemsManager.register(new PropertyGridUiItemsProvider());
    // Register item provider
  }
}

if (IModelApp.extensionAdmin) {
  IModelApp.extensionAdmin.register(new PropertyGridExtension("propertyGrid"));
}
