/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { IModelApp } from "@itwin/core-frontend";
import { MapLayersUI } from "./mapLayers";

import type { GuidString } from "@itwin/core-bentley";

/** @internal */
export interface BasemapColorPreferencesContent {
  customColor?: string; // TBGR color value as string - user's custom color choice
  activeColor?: string; // TBGR color value as string - currently active color
}

/** A wrapper around user preferences to store basemap solid fill colors.
 * Supports both user-selected custom colors and active colors (which may be preset or custom).
 * @internal
 */
export class BasemapColorPreferences {
  private static readonly _preferenceNamespace = "BasemapColor-SettingsService";
  private static readonly _preferenceKey = "solidFillColors";

  /** Store the user-selected custom basemap color preference.
   * This preserves the user's custom color choice even when they switch to presets.
   * @param color TBGR color value as string
   * @param iTwinId iTwin identifier
   * @param iModelId iModel identifier (optional, if not provided stores at iTwin level)
   */
  public static async saveCustomColor(color: string, iTwinId: GuidString, iModelId?: GuidString): Promise<boolean> {
    try {
      const existing = await BasemapColorPreferences.getPreferences(iTwinId, iModelId);
      const colorPreference: BasemapColorPreferencesContent = {
        customColor: color,
        activeColor: existing?.activeColor || color, // Keep existing active or set to this color
      };
      return await BasemapColorPreferences.savePreferences(colorPreference, iTwinId, iModelId);
    } catch {
      return false;
    }
  }

  /** Store the currently active basemap color.
   * This tracks what color is currently being used, whether it's custom or preset.
   * @param color TBGR color value as string
   * @param iTwinId iTwin identifier
   * @param iModelId iModel identifier (optional, if not provided stores at iTwin level)
   */
  public static async saveActiveColor(color: string, iTwinId: GuidString, iModelId?: GuidString): Promise<boolean> {
    try {
      const existing = await BasemapColorPreferences.getPreferences(iTwinId, iModelId);
      const colorPreference: BasemapColorPreferencesContent = {
        customColor: existing?.customColor, // Preserve user's custom color
        activeColor: color,
      };
      return await BasemapColorPreferences.savePreferences(colorPreference, iTwinId, iModelId);
    } catch {
      return false;
    }
  }

  /** Get the user's selected custom color.
   * @param iTwinId iTwin identifier
   * @param iModelId iModel identifier (optional)
   * @returns The stored user-selected color as TBGR string, or undefined if not found
   */
  public static async getCustomColor(iTwinId: GuidString, iModelId?: GuidString): Promise<string | undefined> {
    const preferences = await BasemapColorPreferences.getPreferences(iTwinId, iModelId);
    return preferences?.customColor;
  }

  /** Get the currently active color.
   * @param iTwinId iTwin identifier
   * @param iModelId iModel identifier (optional)
   * @returns The stored active color as TBGR string, or undefined if not found
   */
  public static async getActiveColor(iTwinId: GuidString, iModelId?: GuidString): Promise<string | undefined> {
    const preferences = await BasemapColorPreferences.getPreferences(iTwinId, iModelId);
    return preferences?.activeColor;
  }

  /** Get all color preferences.
   * @param iTwinId iTwin identifier
   * @param iModelId iModel identifier (optional)
   * @returns The stored preferences, or undefined if not found
   */
  public static async getPreferences(iTwinId: GuidString, iModelId?: GuidString): Promise<BasemapColorPreferencesContent | undefined> {
    if (!MapLayersUI.iTwinConfig) {
      return undefined;
    }

    try {
      const accessToken = undefined !== IModelApp.authorizationClient ? await IModelApp.authorizationClient.getAccessToken() : undefined;

      // Try to get from iModel level first (more specific)
      if (iModelId) {
        try {
          const iModelResult = await MapLayersUI.iTwinConfig.get({
            accessToken,
            namespace: BasemapColorPreferences._preferenceNamespace,
            key: BasemapColorPreferences._preferenceKey,
            iTwinId,
            iModelId,
          });

          if (iModelResult) {
            return iModelResult;
          }
        } catch {
          // Fall through to try iTwin level
        }
      }

      // Try iTwin level
      const iTwinResult = await MapLayersUI.iTwinConfig.get({
        accessToken,
        namespace: BasemapColorPreferences._preferenceNamespace,
        key: BasemapColorPreferences._preferenceKey,
        iTwinId,
      });

      return iTwinResult;
    } catch {
      return undefined;
    }
  }

  /** Save color preferences.
   * @param preferences The preferences to save
   * @param iTwinId iTwin identifier
   * @param iModelId iModel identifier (optional)
   */
  private static async savePreferences(preferences: BasemapColorPreferencesContent, iTwinId: GuidString, iModelId?: GuidString): Promise<boolean> {
    if (!MapLayersUI.iTwinConfig) {
      return false;
    }

    try {
      const accessToken = undefined !== IModelApp.authorizationClient ? await IModelApp.authorizationClient.getAccessToken() : undefined;

      await MapLayersUI.iTwinConfig.save({
        accessToken,
        content: preferences,
        namespace: BasemapColorPreferences._preferenceNamespace,
        key: BasemapColorPreferences._preferenceKey,
        iTwinId,
        iModelId,
      });

      return true;
    } catch {
      return false;
    }
  }
}
