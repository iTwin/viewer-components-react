/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { IModelApp } from "@itwin/core-frontend";

import type { Observable } from "rxjs";

import { ApiService } from "../api/ApiService";

export class ConfigSettingsService {

  // We've added a prefix to all settings storage keys to allow for potential extensibility in the future
  private static settingsField = "config";

  private static endpoints = {
    getSettings: "/api/configSettingsJson/",
    saveSettings: "/api/configSettingsJson",
  };

  public static getConfigSettings$(projectId: string): Observable<{[key: string]: any }> {
    return ApiService.sendRequest$(this.endpoints.getSettings + this.getConfigSettingsKey(projectId));
  }

  public static saveConfigSettings$(projectId: string, data: {[key: string]: any}): Observable<{[key: string]: any }> {
    return ApiService.sendRequest$(
      this.endpoints.saveSettings,
      "PUT",
      { data: { id: this.getConfigSettingsKey(projectId), rawJson: data } }
    );
  }

  private static getConfigSettingsKey(projectId: string): string {
    return `${IModelApp.viewManager.selectedView?.iModel.iTwinId}-` +
      `${IModelApp.viewManager.selectedView?.iModel.iModelId}-` +
      `${projectId}-${this.settingsField}`;
  }

}
