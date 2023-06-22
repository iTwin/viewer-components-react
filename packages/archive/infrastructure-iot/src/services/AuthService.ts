/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { IModelApp } from "@itwin/core-frontend";

import type { Observable} from "rxjs";
import { BehaviorSubject, from, of, throwError } from "rxjs";
import { filter, map, switchMap, tap } from "rxjs/operators";
import { plainToInstance } from "class-transformer";
import type { AxiosResponse } from "axios";
import axios from "axios";

import { AuthState } from "../models/auth/AuthStateModel";
import { ConfigService } from "./ConfigService";
import { LoggerService } from "./LoggerService";

class AuthServiceSingleton {

  private initialized = false;
  private authState = new BehaviorSubject<AuthState | null | undefined>(undefined);

  private endpoints = {
    iModelAccessRequest: "/api/auth/iModelAccessRequest",
  };

  public authState$(): Observable<AuthState | null> {
    this.initialize();
    return this.authState.pipe(
      filter((authState: AuthState | null | undefined) => authState !== undefined)
    ) as Observable<AuthState | null>;
  }

  public getIModelAccess$(requestSensemetricsAuthToken = false): Observable<AuthState> {
    return ConfigService.getRestApi$()
      .pipe(
        switchMap((restApi: string) => {
          return this.getITwinAccessToken$()
            .pipe(
              switchMap((accessToken: string | null) => {
                if (accessToken) {
                  let requestUrl = restApi + this.endpoints.iModelAccessRequest;
                  if (requestSensemetricsAuthToken) {
                    requestUrl += "?includeAccess=true";
                  }
                  return from(
                    axios.post(requestUrl, {
                      iModelId: IModelApp.viewManager.selectedView?.iModel.iModelId,
                      token: accessToken,
                    })
                  ).pipe(
                    tap({
                      error: (error: any) => {
                        LoggerService.warn("Error retrieving iModel access:", error.response || error);
                      },
                    }),
                    map((response: AxiosResponse<{associations: {[key: string]: any}[]}>) => {
                      if (response.data.associations && response.data.associations.length) {
                        LoggerService.log("Retrieved iModel access:", response.data);
                        return plainToInstance(AuthState, response.data.associations[0]);
                      } else {
                        LoggerService.warn("Received malformed iModel access data:", response.data);
                        return throwError(() => {});
                      }
                    })
                  ) as Observable<AuthState>;
                } else {
                  LoggerService.warn("Error loading iModel access: User access token not available");
                  return throwError(() => {});
                }
              })
            );
        })
      );
  }

  private initialize(): void {
    if (!this.initialized) {

      this.initialized = true;

      // Wait for config service to finish its initialization, which is triggered from App.tsx
      ConfigService.getRestApi$()
        .subscribe(() => {

          // Next, attempt to get sensemetrics API key if current iModel is associated with a project
          this.getIModelAccess$(false)
            .subscribe({
              next: (authState: AuthState) => this.authState.next(authState),
              error: () => this.authState.next(null),
            });
        });
    }
  }

  private getITwinAccessToken$(): Observable<string | null> {
    if (IModelApp.authorizationClient) {
      return from(IModelApp.authorizationClient.getAccessToken());
    } else {
      return of(null);
    }
  }

}

export const AuthService: AuthServiceSingleton = new AuthServiceSingleton();
