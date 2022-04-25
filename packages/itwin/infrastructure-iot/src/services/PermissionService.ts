/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { Observable, of } from "rxjs";
import { catchError, map, tap } from "rxjs/operators";
import { forEach as _forEach, get as _get } from "lodash";

import { AccessLevel } from "../enums/AccessLevelEnum";
import { ApiService } from "./api/ApiService";
import { LoggerService } from "./LoggerService";

export class PermissionService {

  private static endpoints = {
    getPermissions: "/api/permissions/",
  };

  public static getPermissions$(objectType: string, objectIds: string[]): Observable<{[key: string]: AccessLevel}> {

    // Start with a set of default permissions (read-only)
    const permissions: {[key: string]: AccessLevel} = {};
    _forEach(objectIds, (id: string) => permissions[id] = AccessLevel.READ_ONLY);

    // Retrieve permission data from server
    return ApiService.sendRequest$(
      PermissionService.endpoints.getPermissions + objectType.toUpperCase(),
      "GET",
      { params: { dataIds: objectIds } }
    ).pipe(
      tap((data: any) => LoggerService.log(`Received ${objectType} permissions:`, data)),
      map((data: { permissions: any[] }) => {
        if (data.permissions && data.permissions.length) {
          _forEach(data.permissions, (permissionData: any) => {
            permissions[permissionData.id] = _get(permissionData, ["userAccessRights", 0, "accessLevel"]) ||
              AccessLevel.READ_ONLY;
          });
        }
        return permissions;
      }),
      catchError(() => {
        return of(permissions);
      })
    );
  }

}
