/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { map as _map } from "lodash";

import { AlertPriority } from "../../enums/alerts/AlertPriorityEnum";
import { AlertPriorityMetadataObject } from "./AlertPriorityMetadataObjectInterface";

export class AlertPriorityMetadata {

  private static readonly metadata: {[key: string]: AlertPriorityMetadataObject} = {
    default: {
      id: "default",
      priority: 0,
      name: "Normal",
      color: "#02b74f",
    },
    [AlertPriority.LOW]: {
      id: AlertPriority.LOW,
      priority: 1,
      name: "Low",
      color: "#d8d84f",
    },
    [AlertPriority.NORMAL]: {
      id: AlertPriority.NORMAL,
      priority: 2,
      name: "Moderate",
      color: "#ec971f",
    },
    [AlertPriority.HIGH]: {
      id: AlertPriority.HIGH,
      priority: 3,
      name: "High",
      color: "#bd362f",
    },
    [AlertPriority.EXTREME]: {
      id: AlertPriority.EXTREME,
      priority: 4,
      name: "Critical",
      color: "#c20ac2",
    },
  };

  public static getAllMetadata(): AlertPriorityMetadataObject[] {
    return _map(this.metadata, ((metadata: AlertPriorityMetadataObject) => metadata));
  }

  public static getMetadata(priority: AlertPriority | "default"): AlertPriorityMetadataObject {
    return this.metadata[priority];
  }

  public static getDefaultAlertColors(): string[] {
    return this.getAllMetadata().map(((metadata: AlertPriorityMetadataObject) => metadata.color));
  }

}
