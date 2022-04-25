/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { Entity } from "./EntityModel";
import { EntityType } from "../../enums/entities/EntityTypeEnum";
import { UtilitiesService } from "../../services/UtilitiesService";

export class Sensor extends Entity {

  private readonly device?: string;

  public getEntityType(): EntityType {
    return EntityType.SENSOR;
  }

  public getEntityTypeReadable(): string {
    return "sensor";
  }

  public getNodeId(): string {
    return this.props.NODE_ID;
  }

  public getDeviceId(): string | undefined {
    return this.device;
  }

  public getBaselineElevation(): number {
    return this.props.ELEVATION_REFERENCE || this.getElevation() || 0;
  }

  public override getLastActive(): string {
    if (this.props.LAST_OBSERVATION && this.props.LAST_OBSERVATION.timestamp) {
      return `Active ${UtilitiesService.formatDate(this.props.LAST_OBSERVATION.timestamp, true)}`;
    } else {
      return "Never been active";
    }
  }

  public getLastObsTime(): string | undefined {
    if (this.props.LAST_OBSERVATION && this.props.LAST_OBSERVATION.timestamp) {
      return UtilitiesService.formatDate(this.props.LAST_OBSERVATION.timestamp);
    } else {
      return undefined;
    }
  }

}
