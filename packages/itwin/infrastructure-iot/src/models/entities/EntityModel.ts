/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { DataObject } from "../DataObjectModel";
import { EntityStatus } from "../../enums/entities/EntityStatusEnum";
import { EntityType } from "../../enums/entities/EntityTypeEnum";
import { UtilitiesService } from "../../services/UtilitiesService";

export abstract class Entity extends DataObject {

  protected readonly type?: string;

  protected constructor(id: string) {
    super(id);
  }

  public abstract getEntityType(): EntityType;

  public isNode(): boolean {
    return this.getEntityType() === EntityType.NODE;
  }

  public isDevice(): boolean {
    return this.getEntityType() === EntityType.DEVICE;
  }

  public isSensor(): boolean {
    return this.getEntityType() === EntityType.SENSOR;
  }

  public getType(): string | undefined {
    if (this.type === "DYNAMIC") {
      return this.props.INTEGRATION_ID;
    } else {
      return this.type;
    }
  }

  public isSDE(): boolean {
    return this.type === "DYNAMIC";
  }

  public getModel(): string {
    return this.props.MODEL;
  }

  public getSerialNumber(): string {
    return this.props.SERIAL_NO;
  }

  public getStatus(): EntityStatus {
    if (this.props.ARCHIVED) {
      return EntityStatus.ARCHIVE;
    } else if (this.props.HOST_REDIRECT) {
      return this.props.ACCESSIBLE ? EntityStatus.ONLINE : EntityStatus.REDIRECT;
    } else if (this.props.ASLEEP) {
      return EntityStatus.SLEEP;
    } else {
      return this.props.ACCESSIBLE ? EntityStatus.ONLINE : EntityStatus.OFFLINE;
    }
  }

  public getStatusReadable(): string {
    const status = this.getStatus();
    switch (status) {
      case EntityStatus.OFFLINE:
        return "Offline";
      case EntityStatus.SLEEP:
        return "Low Power Mode";
      case EntityStatus.ARCHIVE:
        return "Archived";
      case EntityStatus.REDIRECT:
        return "Redirected";
      default:
        return "Online";
    }
  }

  public isOnline(): boolean {
    return this.getStatus() === EntityStatus.ONLINE;
  }

  public isRedirected(): boolean {
    return this.getStatus() === EntityStatus.REDIRECT;
  }

  public getLastActive(): string {
    if (this.getStatus() === EntityStatus.ONLINE) {
      return "Active now";
    } else {
      return `Active ${UtilitiesService.formatDate(this.props.LAST_COMM, true)}`;
    }
  }

  public getObservationCount(): number {
    return this.props.OBSERVATION_COUNT || 0;
  }

  public getSamplingInterval(): number | undefined  {
    const samplingFrequency = this.props.SAMPLING_RATE_REQUESTED;
    return samplingFrequency ? 1 / samplingFrequency : undefined;
  }

  public getSamplingIntervalFormatted(): string {
    const samplingInterval = this.getSamplingInterval();
    let samplingIntervalFormatted = "";
    if (samplingInterval) {
      if (samplingInterval < 60) {
        samplingIntervalFormatted = `${samplingInterval} Second${samplingInterval > 1 ? "s" : ""}`;
      } else {
        samplingIntervalFormatted = `${samplingInterval / 60} Minute${samplingInterval / 60 > 1 ? "s" : ""}`;
      }
    }
    return samplingIntervalFormatted;
  }

}
