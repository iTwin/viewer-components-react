/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { AlertType } from "../../enums/alerts/AlertTypeEnum";
import { DataObject } from "../DataObjectModel";
import { UtilitiesService } from "../../services/UtilitiesService";

export class AlertTrigger extends DataObject {

  private readonly alertId?: string;
  private readonly alertType?: AlertType;

  private readonly timestamp?: string;
  private description?: string;

  // Data alert fields
  private readonly context: {[key: string]: any}[] = [];

  // Status alert fields
  private readonly duration?: number;

  public isActive(): boolean {
    return !this.props.LAST_EVENT;
  }

  public getAlertId(): string | undefined {
    return this.alertId;
  }

  public getType(): AlertType {
    return this.alertType || AlertType.DATA;
  }

  public getDate(): string | undefined {
    return this.timestamp ? UtilitiesService.formatDate(this.timestamp) : undefined;
  }

  public getDescription(): string | undefined {
    return this.description;
  }

  public getDescriptionFields(): {[key: string]: any} {
    if (this.getType() === AlertType.DATA) {
      return { context: this.context, lastObservation: this.props.LAST_OBSERVATION };
    } else {
      return { duration: this.duration };
    }
  }

  public setDescription(description: string): void {
    this.description = description;
  }

}
