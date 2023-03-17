/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { Localization } from "@itwin/core-common";
import { IModelApp, UserPreferencesAccess } from "@itwin/core-frontend";
// import { MapLayersUiItemsProvider } from "./ui/MapLayersUiItemsProvider";
// import { FeatureInfoUiItemsProvider } from "./ui/FeatureInfoUiItemsProvider";

export interface MapLayersConfig {
  localization?: Localization;
  /** If an iTwinConfig is provided, it will be used to load the MapLayerSources that are stored. */
  iTwinConfig?: UserPreferencesAccess;
}

/** MapLayersUI is use when the package is used as a dependency to another app.
 * '''ts
 *  await MapLayersUI.initialize({...MapLayersInitProps});
 * '''
 * @beta
 */
export class MapLayersUI {
  private static _defaultNs = "mapLayers";
  public static localization: Localization;
  private static _uiItemsProvidersId: string[] = [];
  private static _iTwinConfig?: UserPreferencesAccess;

  public static get iTwinConfig(): UserPreferencesAccess | undefined {
    return this._iTwinConfig;
  }

  /** Used to initialize the Map Layers */
  public static async initialize(config?: MapLayersConfig): Promise<void> {
    // register namespace containing localized strings for this package
    MapLayersUI.localization = config?.localization ?? IModelApp.localization;
    await MapLayersUI.localization.registerNamespace(
      MapLayersUI.localizationNamespace
    );

    MapLayersUI._iTwinConfig = config?.iTwinConfig;
  }

  /** Unregisters internationalization service namespace and UiItemManager  */
  public static terminate() {
    IModelApp.localization.unregisterNamespace(MapLayersUI.localizationNamespace);
  }

  /** The internationalization service namespace. */
  public static get localizationNamespace(): string {
    return MapLayersUI._defaultNs;
  }
}
