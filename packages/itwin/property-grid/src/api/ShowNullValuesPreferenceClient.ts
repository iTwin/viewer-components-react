/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { IModelApp } from "@itwin/core-frontend";
import { Logger } from "@itwin/core-bentley";

const PROPERTY_GRID_NAMESPACE = "PropertyGridPreferences";
const PROPERTY_GRID_SHOWNULL_KEY = "showNullValues";
const LOGGER_CATEGORY = "PropertyGrid";

// Get showNullValues toggle from UserPreferences (corresponds to hide / show empty fields)
export const getShowNullValuesPreference = async () => {
  const userPrefs = IModelApp.userPreferences;
  if (userPrefs) {
    const accessToken = await IModelApp.getAccessToken();
    try {
      const showNullValuesRes = await userPrefs.get({
        accessToken,
        namespace: PROPERTY_GRID_NAMESPACE,
        key: PROPERTY_GRID_SHOWNULL_KEY,
      });
      if (showNullValuesRes !== undefined) {
        return showNullValuesRes === "true";
      }
    } catch (error) {
      Logger.logError(
        LOGGER_CATEGORY,
        `error saving showNullValues user preference: ${error}`
      );
    }
  }
  return true; // Default to showing empty fields
};

// Save showNullValues toggle to UserPreferences (corresponds to hide / show empty fields)
export const saveShowNullValuesPreference = async (value: boolean) => {
  const userPrefs = IModelApp.userPreferences;
  if (userPrefs) {
    const accessToken = await IModelApp.getAccessToken();
    try {
      await userPrefs.save({
        accessToken,
        content: String(value),
        namespace: PROPERTY_GRID_NAMESPACE,
        key: PROPERTY_GRID_SHOWNULL_KEY,
      });
    } catch (error) {
      Logger.logError(
        LOGGER_CATEGORY,
        `error saving showNullValues user preference: ${error}`
      );
    }
  }
};
