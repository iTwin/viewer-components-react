/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import type { Observable } from "rxjs";
import { BehaviorSubject } from "rxjs";
import { filter } from "rxjs/operators";

import { plainToInstance } from "class-transformer";
import { chain as _chain } from "lodash";

import { EntityType } from "../../enums/entities/EntityTypeEnum";
import { EntityTypeMetadata } from "../../models/entities/EntityTypeMetadataModel";
import type { Sensor } from "../../models/entities/SensorModel";
import { ApiService } from "../api/ApiService";
import { LoggerService } from "../LoggerService";

declare interface EntityTypes {
  [key: string]: EntityTypeMetadata;
}

class EntityTypeServiceSingleton {

  private types = {
    node: new BehaviorSubject<EntityTypes>({}),
    device: new BehaviorSubject<EntityTypes>({}),
    sensor: new BehaviorSubject<EntityTypes>({}),
  };

  private retrievingTypes = {
    node: false,
    device: false,
    sensor: false,
  };

  public types$(entityType: EntityType): Observable<EntityTypes> {
    this.getTypes(entityType);
    return this.types[entityType].pipe(
      filter((entityTypes: EntityTypes) => !!Object.keys(entityTypes).length)
    );
  }

  public getType(entityType: EntityType, entitySubType: string): EntityTypeMetadata {
    const type = this.types[entityType].getValue()[entitySubType];
    if (type) {
      return type;
    } else {
      LoggerService.warn("No type metadata found for:", entityType, entitySubType);
      return new EntityTypeMetadata();
    }
  }

  public getEntityTypeReadable(entityType?: EntityType): string {
    if (entityType) {
      switch (entityType) {
        case EntityType.NODE:
          return "connection";
        default:
          return entityType.toString();
      }
    } else {
      return "connection";
    }
  }

  public getSensorTypeReadable(sensor: Sensor): string {

    // Figure out if this is a diagnostics sensor by checking its id
    const isDiagnosticSensor = sensor.getId().includes("woodstock/device");

    // If it's a diagnostics, attempt to match to one of the known types
    if (isDiagnosticSensor) {
      if (sensor.getId().includes("batteryVoltage/sensor")) {
        return "Battery Voltage";
      } else if (sensor.getId().includes("chargeInputVoltage/sensor")) {
        return "Input Voltage";
      } else if (
        sensor.getId().includes("volt/sensor") ||
        sensor.getId().includes("inputVoltage/sensor")
      ) {
        return "System Voltage";
      } else if (sensor.getId().includes("inputCurrent/sensor")) {
        return "Input Current";
      } else if (sensor.getId().includes("press/sensor")) {
        return "Barometric Pressure";
      } else if (
        sensor.getId().includes("temp/sensor") ||
        sensor.getId().includes("tmp36ext/sensor")
      ) {
        return "System Temperature";
      }
    }

    // Fall back to just the regular readable sensor type
    return this.getType(EntityType.SENSOR, sensor.getType() as string).getName() as string;
  }

  private getEndpoint(entityType: EntityType): string {
    return `/api/${entityType}s/types`;
  }

  private getTypes(entityType: EntityType): void {
    if (!this.retrievingTypes[entityType]) {
      this.retrievingTypes[entityType] = true;
      ApiService.sendRequest$(this.getEndpoint(entityType))
        .subscribe({
          next: (data: {[key: string]: any[]}) => {
            LoggerService.log("Received entity types for", entityType, ":", data);
            this.types[entityType].next(
              _chain(data[`${entityType}Types`])
                .keyBy((type: any) => type.id)
                .mapValues((type: object) => plainToInstance(EntityTypeMetadata, type))
                .value() as any
            );
          },
          error: () => {},
          complete: () => {
            this.retrievingTypes[entityType] = false;
          },
        }
        );
    }
  }

}

export const EntityTypeService: EntityTypeServiceSingleton = new EntityTypeServiceSingleton();
