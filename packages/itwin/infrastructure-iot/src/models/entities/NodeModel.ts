/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { Entity } from "./EntityModel";
import { EntityType } from "../../enums/entities/EntityTypeEnum";

export class Node extends Entity {

  public getEntityType(): EntityType {
    return EntityType.NODE;
  }

  public getEntityTypeReadable(): string {
    return "connection";
  }

  public isThread(): boolean {
    return this.getType() === "THREAD" || this.getType() === "THREAD_SDE";
  }

  public getFirmwareVersion(): string {

    let version: string = this.props.VERSION;

    // The version stored on the node is in the form of "V1_2_3"
    // so we need to clean it up a bit into X.X.X format
    if (version) {
      version = version.replace(/V/i, "").replace(/_/g, ".");
    }

    return version;
  }

}
