/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { IModelApp } from "@itwin/core-frontend";
import { Logger } from "@itwin/core-bentley";

const PROPERTY_GRID_NAMESPACE = "PropertyGridPreferences";
const LOGGER_CATEGORY = "PropertyGrid";

/**
 * Interface defining storage used by `PropertyGridComponent` to persist preferences.
 * @public
 */
export interface PreferencesStorage {
  set(key: string, value: string): Promise<void>;
  get(key: string): Promise<string | undefined>;
}

/**
 * Default storage used by `PropertyGridComponent` to persist preferences. It uses `IModelApp.userPreferences`
 * and, by default, persists preferences under `PropertyGridPreferences` namespace.
 * @public
 */
export class IModelAppUserPreferencesStorage implements PreferencesStorage {
  constructor(private _nameSpace = PROPERTY_GRID_NAMESPACE) {}

  public async set(key: string, value: string): Promise<void> {
    if (!IModelApp.userPreferences) {
      Logger.logError(LOGGER_CATEGORY, `Cannot save user preference ${key} because 'IModelApp.userPreferences' not defined.`);
      return;
    }

    const accessToken = await IModelApp.getAccessToken();
    try {
      await IModelApp.userPreferences.save({
        accessToken,
        content: value,
        namespace: this._nameSpace,
        key,
      });
    } catch (error) {
      Logger.logError(LOGGER_CATEGORY, `Error saving ${key} user preference: ${error}`);
    }
  }

  public async get(key: string): Promise<string | undefined> {
    if (!IModelApp.userPreferences) {
      Logger.logError(LOGGER_CATEGORY, `Cannot get persisted user preference ${key} because 'IModelApp.userPreferences' not defined.`);
      return undefined;
    }

    const accessToken = await IModelApp.getAccessToken();
    try {
      return await IModelApp.userPreferences.get({
        accessToken,
        namespace: this._nameSpace,
        key,
      });
    } catch (error) {
      Logger.logError(LOGGER_CATEGORY, `Error getting ${key} user preference: ${error}`);
    }
    return undefined;
  }
}
