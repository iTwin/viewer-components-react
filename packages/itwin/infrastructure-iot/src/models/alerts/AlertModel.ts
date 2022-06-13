/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { AlertType } from "../../enums/alerts/AlertTypeEnum";
import { DataObject } from "../DataObjectModel";
import type { AlertPriority } from "../../enums/alerts/AlertPriorityEnum";
import type { AlertState } from "../../enums/alerts/AlertStateEnum";
import type { AlertTrigger } from "./AlertTriggerModel";

export class Alert extends DataObject {

  private readonly alertType?: AlertType;

  private lastTrigger?: AlertTrigger;

  public getType(): AlertType {
    return this.alertType || AlertType.DATA;
  }

  public getPriority(): AlertPriority {
    return this.props.PRIORITY;
  }

  public getState(): AlertState {
    return this.props.STATE;
  }

  public getLastTrigger(): AlertTrigger | undefined {
    return this.lastTrigger;
  }

  public setLastTrigger(trigger: AlertTrigger): void {
    this.lastTrigger = trigger;
  }

}
