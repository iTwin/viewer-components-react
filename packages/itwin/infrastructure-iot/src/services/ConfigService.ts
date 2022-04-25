/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { IModelApp } from "@itwin/core-frontend";

import { BehaviorSubject, Observable } from "rxjs";
import { first, map } from "rxjs/operators";
import { get as _get } from "lodash";
import axios, { AxiosResponse } from "axios";

import { AppConfig } from "../models/AppConfigInterface";
import { DeviceDecorator } from "../components/decorators/DeviceDecorator";

class ConfigServiceSingleton {

  private initialized = false;

  private environment: "production" | "development" = "production";
  private enableLogging = false;

  private config = new BehaviorSubject<{[key: string]: any} | undefined>(undefined);

  private configEndpoints = {
    production: "https://com-config-service.sensemetrics.engineering/itwin-app.sensemetrics.com.json",
    development: "https://com-config-service.sensemetrics.engineering/itwin-dev.sensemetrics.com.json",
  };

  public async initialize(config?: AppConfig): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.initialized) {

        this.initialized = true;

        // Add our custom decorator to iModel
        IModelApp.viewManager.addDecorator(new DeviceDecorator());

        // Save provided config options
        if (config) {
          this.environment = config.environment === "development" ? "development" : "production";
          this.enableLogging = config.enableLogging !== undefined ? config.enableLogging : this.enableLogging;
        }

        // Retrieve sensemetrics config data from server
        axios.get(this.configEndpoints[this.environment])
          .then((response: AxiosResponse<{[key: string]: any}>) => {
            if (this.enableLogging) {
              console.log("IoT | Received config data:", response.data); // eslint-disable-line no-console
            }
            this.config.next(response.data);
            this.loadExternalResources();
            resolve();
          })
          .catch((error: any) => {
            console.warn("IoT | Error retrieving config:", error.response || error); // eslint-disable-line no-console
            reject(new Error("Error retrieving IoT environment configuration"));
          });
      } else {
        resolve();
      }
    });
  }

  public isLoggingEnabled(): boolean {
    return this.enableLogging;
  }

  public getRestApi$(): Observable<string> {
    return this.getConfigField$<string>("api");
  }

  public getSocketApi$(): Observable<string> {
    return this.getConfigField$<string>("apiWs");
  }

  public getSocketTimeout$(): Observable<number> {
    return this.getConfigField$<number>("socketTimeout");
  }

  public getTermsUrl(): string | undefined {
    return _get(this.config.getValue(), "ui.termsUrl");
  }

  public getPrivacyUrl(): string | undefined  {
    return _get(this.config.getValue(), "ui.privacyUrl");
  }

  private getConfigField$<T>(path: string): Observable<T> {
    return this.config
      .pipe(
        first((value: {[key: string]: any} | undefined) => !!value),
        map((config: {[key: string]: any} | undefined) => _get(config, path))
      );
  }

  private loadExternalResources(): void {

    // Load sensemetrics Icon Font
    const iconFontUrl = _get(this.config.getValue(), "ui.iconFontUrl");
    if (iconFontUrl) {
      const linkTag = document.createElement("link");
      linkTag.rel = "stylesheet";
      linkTag.href = iconFontUrl;
      document.head.appendChild(linkTag);
    } else {
      console.warn("IoT | Failed to load icon font: iconFontUrl not found in config", this.config.getValue()); // eslint-disable-line no-console
    }
  }

}

export const ConfigService: ConfigServiceSingleton = new ConfigServiceSingleton();
