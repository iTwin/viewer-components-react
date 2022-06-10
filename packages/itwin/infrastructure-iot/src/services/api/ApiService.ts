/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import type { Observable} from "rxjs";
import { from, throwError } from "rxjs";
import { first, map, switchMap, tap } from "rxjs/operators";
import { forEach as _forEach, isArray as _isArray } from "lodash";
import type { AxiosResponse, Method } from "axios";
import axios from "axios";

import type { AuthState } from "../../models/auth/AuthStateModel";
import { ConfigService } from "../ConfigService";
import { AuthService } from "../AuthService";
import { LoggerService } from "../LoggerService";

export class ApiService {

  public static sendRequest$(
    endpoint: string,
    method: Method = "GET",
    options?: {params?: {[key: string]: any}, data?: {[key: string]: any}}
  ): Observable<any> {
    return ConfigService.getRestApi$()
      .pipe(
        switchMap((restApi: string) => {
          return AuthService.authState$()
            .pipe(
              first((authState: AuthState | null) => !!authState),
              switchMap((authState: AuthState | null) => {
                if (authState) {

                  // Add query params to url
                  const queryParams = new URLSearchParams({projectIds: authState.getProjectId()});
                  if (options && options.params) {
                    _forEach(options.params, (value: string, key: any) => {

                      // Multiple fields must be added individually eg: fields=prop1&fields=prop2
                      if (_isArray(value)) {
                        _forEach(value, (v: any) => queryParams.append(key, v));
                      } else {
                        queryParams.append(key, value);
                      }
                    });
                  }

                  // Perform the request
                  return from(
                    axios({
                      method,
                      url: restApi + endpoint,
                      headers: {
                        Authorization: `Bearer ${authState.getApiKey()}`,
                      },
                      params: queryParams,
                      data: options?.data,
                    })
                  ).pipe(
                    tap({
                      error: (error: any) => {
                        LoggerService.warn(
                          `Error performing request ${endpoint}:`,
                          error.response || error
                        );
                      },
                    }),
                    map((response: AxiosResponse<any>) => response.data)
                  );
                } else {
                  LoggerService.warn("Attempted to perform api request while not authenticated:", endpoint);
                  return throwError(() => {});
                }
              })
            );
        })
      );
  }

}
