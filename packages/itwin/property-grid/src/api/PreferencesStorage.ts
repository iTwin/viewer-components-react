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
 * Default storage used by `PropertyGridComponent` to persist preferences. It defaults to using `IModelApp.UserPreferences`
 * and persisting preferences under `PropertyGridPreferences` namespace.
 * @public
 */
export class DefaultPreferencesStorage implements PreferencesStorage {
  constructor(private _nameSpace = PROPERTY_GRID_NAMESPACE) {}

  public async set(key: string, value: string): Promise<void> {
    // istanbul ignore if
    if (!IModelApp.userPreferences) {
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
      Logger.logError(LOGGER_CATEGORY, `error saving showNullValues user preference: ${error}`);
    }
  }

  public async get(key: string): Promise<string | undefined> {
    if (!IModelApp.userPreferences) {
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
      Logger.logError(LOGGER_CATEGORY, `error saving showNullValues user preference: ${error}`);
    }
    return undefined;
  }
}
