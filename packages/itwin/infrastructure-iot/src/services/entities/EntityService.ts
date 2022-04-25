/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { combineLatest, Observable, of, throwError } from "rxjs";
import { catchError, first, map, switchMap, tap } from "rxjs/operators";
import { instanceToInstance, plainToInstance } from "class-transformer";
import { map as _map } from "lodash";

import { EntityType } from "../../enums/entities/EntityTypeEnum";
import { SearchQuery } from "../../models/SearchQueryModel";
import { Node } from "../../models/entities/NodeModel";
import { Device } from "../../models/entities/DeviceModel";
import { Sensor } from "../../models/entities/SensorModel";
import { AuthState } from "../../models/auth/AuthStateModel";
import { ConfigService } from "../ConfigService";
import { AuthService } from "../AuthService";
import { ApiService } from "../api/ApiService";
import { EntityTypeService } from "./EntityTypeService";
import { UtilitiesService } from "../UtilitiesService";
import { LoggerService } from "../LoggerService";

class EntityServiceSingleton {

  private entityCache = {
    node: { } as {[key: string]: Node},
    device: { } as {[key: string]: Device},
    sensor: { } as {[key: string]: Sensor},
  };

  public getEntities$(entityType: EntityType, searchQuery: SearchQuery): Observable<(Node | Device | Sensor)[]> {
    return EntityTypeService.types$(entityType).pipe(
      first(),
      switchMap(() => {
        return ApiService.sendRequest$(
          this.getEndpoint("getEntities", entityType) as string,
          "GET",
          { params: searchQuery.getQueryParams() }
        ).pipe(
          tap((data: any) => LoggerService.log(`Received ${entityType}s:`, data)),
          catchError(() => of([])),
          map((data: object[]) => {

            // Update search query pagination parameters before we filter results
            searchQuery.checkResults(data.length);

            // Convert raw response to appropriate entity class
            return _map(data, (dataObject: object) => {
              return plainToInstance<Node | Device | Sensor, object>(this.getEntityClass(entityType), dataObject);
            });
          })
        );
      })
    );
  }

  public getEntity$(entityType: EntityType, id: string): Observable<Node | Device | Sensor> {
    if (this.entityCache[entityType][id]) {
      return of(instanceToInstance(this.entityCache[entityType][id]));
    } else {
      return EntityTypeService.types$(entityType).pipe(
        first(),
        switchMap(() => {
          return ApiService.sendRequest$(this.getEndpoint("getEntity", entityType) as string + id)
            .pipe(
              tap((data: any) => LoggerService.log(`Received ${entityType}:`, data)),
              map((data: object) => {
                const entity = plainToInstance<Node | Device | Sensor, object>(this.getEntityClass(entityType), data);
                this.entityCache[entityType][id] = entity;
                return entity;
              })
            );
        })
      );
    }
  }

  public openExternalEntityUrl$(entity: Sensor): Observable<void> {
    return combineLatest([
      ConfigService.getRestApi$(),
      AuthService.getIModelAccess$(true),
    ]).pipe(
      switchMap(([restApi, authState]: [string, AuthState | null]) => {
        if (authState && authState.getAccessToken()) {

          // Start building the deep link url
          let deepLinkUrl = "";

          // First, we need to build a url to sensor detail page
          // SDE vs non-SDE entities have different links
          if (entity.isSDE()) {
            deepLinkUrl += `/entity-config/details;id=${entity.getEncodedId()};type=SENSOR?`;
          } else {
            deepLinkUrl += `/gwt?route=configure:sensor:%22${UtilitiesService.getHashForString(entity.getId())}%22&`;
          }

          // Next, add project url query param
          deepLinkUrl += `projectIds=${authState.getProjectId()}`;

          // Next we construct a full url to the access token route
          let url = `${restApi}/#/token-log-in?accessToken=${authState.getAccessToken() || ""}`;
          url += `&referringUrl=${encodeURIComponent(deepLinkUrl)}`;

          // Open url in new window
          LoggerService.log("Opening external url for entity:", url);
          window.open(url, "_blank");

          // Complete observable
          return of(void 0);

        } else {
          LoggerService.warn("Unable to open external url: AuthState or AccessToken are not available");
          return throwError(() => {});
        }
      })
    );
  }

  private getEndpoint(endpoint: string, entityType: EntityType): string | undefined {
    switch (endpoint) {
      case "getEntities":
        return `/api/${entityType}s/all`;
      case "getEntitiesByCategory":
        return `/api/${entityType}s`;
      case "getEntity":
      case "deleteEntity":
        return `/api/${entityType}s/`;
      case "getEntityMetadata":
        return `/api/${entityType}s/metadata`;
      case "updateEntity":
        return `/api/${entityType}s`;
      case "createEntity":
        return `/api/${entityType}s/policy/ownership`;
      default:
        return undefined;
    }
  }

  private getEntityClass(entityType: EntityType): any {
    return entityType === EntityType.NODE ? Node : entityType === EntityType.DEVICE ? Device : Sensor;
  }

}

export const EntityService: EntityServiceSingleton = new EntityServiceSingleton();
