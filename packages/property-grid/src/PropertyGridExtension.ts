/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/


import { Extension, IModelApp } from "@bentley/imodeljs-frontend";
import { I18NNamespace } from "@bentley/imodeljs-i18n";
import { UiItemsManager } from "@bentley/ui-abstract";
import { StateManager } from "@bentley/ui-framework";

import { PropertyGridManager } from "./PropertyGridManager";
import { PropertyGridUiItemsProvider } from "./PropertyGridUiItemsProvider";

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
      PropertyGridManager.i18nNamespace
    );
    if (this._i18NNamespace === undefined) {
      throw new Error("Property grid extension could not find locale");
    }
    await this._i18NNamespace.readFinished;
    if (!StateManager.isInitialized()) {
      throw new Error(
        "UiFramework's StateManager must be initialized for Property Grid to work properly as an extension"
      );
    }
    await PropertyGridManager.initialize(this.i18n);
    // Register item provider
    UiItemsManager.register(new PropertyGridUiItemsProvider());
  }
}

if (IModelApp.extensionAdmin) {
  IModelApp.extensionAdmin.register(new PropertyGridExtension("propertyGrid"));
}
