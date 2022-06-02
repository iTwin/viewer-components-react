/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { Entity } from "./EntityModel";
import { EntityType } from "../../enums/entities/EntityTypeEnum";

export class Device extends Entity {

  public getEntityType(): EntityType {
    return EntityType.DEVICE;
  }

  public getEntityTypeReadable(): string {
    return "device";
  }

  public getNodeId(): string {
    return this.props.NODE_ID;
  }

  public getDevicePort(): number {
    return this.props.EXTERNAL_PORT;
  }

  public getIpiDeviceHorizontalMode(): boolean {
    return this.props.MODE === "2D" || this.props.DIMENSIONS === 2;
  }

}
