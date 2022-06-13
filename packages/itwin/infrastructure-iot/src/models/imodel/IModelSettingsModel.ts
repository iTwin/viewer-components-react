/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import type { XYAndZ } from "@itwin/core-geometry";

import { Exclude } from "class-transformer";
import { chain as _chain, forEach as _forEach, map as _map } from "lodash";

import type { AlertPriority } from "../../enums/alerts/AlertPriorityEnum";
import { IModelMarkerStyle } from "../../enums/imodel/IModelMarkerStyleEnum";
import { IModelEntityAssociation } from "./IModelEntityAssociationModel";
import { ObservationQuery } from "../observations/ObservationQueryModel";
import { AlertPriorityMetadata } from "../alerts/AlertPriorityMetadataModel";
import type { AlertPriorityMetadataObject } from "../alerts/AlertPriorityMetadataObjectInterface";

declare interface StoredIModelEntityAssociation {
  entityId: string;
  associationMethod: "element";
  elementId?: string;
  metrics?: StoredIModelEntityMetricConfiguration[];
}

declare interface StoredIModelEntityMetricConfiguration {
  metricId: string;
  unitId?: string;
  metricParams?: {[key: string]: any};
}

export class IModelSettings {

  static readonly defaultMarkerSize = 15;
  static readonly minMarkerSize = 10;
  static readonly maxMarkerSize = 30;

  private readonly associations: {
    sensors: {
      [key: string]: StoredIModelEntityAssociation;
    };
  } = {
    sensors: {},
  };

  private readonly markers: {
    sensors: {
      style: IModelMarkerStyle;
      visible: boolean;
      size: number;
    };
  } = {
    sensors: {
      style: IModelMarkerStyle.OVERLAY,
      visible: true,
      size: IModelSettings.defaultMarkerSize,
    },
  };

  private readonly alerts: {
    style: {[key: string]: { color: string }};
  } = {
    style: { },
  };

  @Exclude({ toPlainOnly: true })
  private selectedEntityId?: string;

  @Exclude({ toPlainOnly: true })
  private readonly elementMetadata: {
    [key: string]: {
      elementId: string;
      elementName?: string;
      elementOrigin?: XYAndZ;
    };
  } = {};

  public getAssociations(elementId?: string): IModelEntityAssociation[] {
    return _chain(this.associations.sensors)
      .filter((association: StoredIModelEntityAssociation) => !elementId || association.elementId === elementId)
      .map((association: StoredIModelEntityAssociation) => this.createIModelEntityAssociation(association))
      .value();
  }

  public getAssociation(entityId: string): IModelEntityAssociation | undefined {
    if (this.associations.sensors[entityId]) {
      return this.createIModelEntityAssociation(this.associations.sensors[entityId]);
    }
    return undefined;
  }

  public hasAssociation(entityId: string): boolean {
    return !!this.getAssociation(entityId);
  }

  public getAssociatedElements(withMissingMetadata = false): string[] {
    return _chain(this.associations.sensors)
      .filter((association: StoredIModelEntityAssociation) => {
        return !!association.elementId && (!withMissingMetadata || !this.elementMetadata[association.elementId]);
      })
      .map((association: StoredIModelEntityAssociation) => association.elementId as string)
      .uniq()
      .value();
  }

  public setAssociation(association: IModelEntityAssociation): void {
    this.associations.sensors[association.getEntityId()] = {
      entityId: association.getEntityId(),
      associationMethod: "element",
      elementId: association.getElementId(),
      metrics: _map(association.getObservationQueries(), (query: ObservationQuery) => {
        return {
          metricId: query.getMetric() as string,
          unitId: query.getUnit(),
          metricParams: query.getMetricParams(),
        };
      }),
    };
  }

  public deleteAssociation(entityId: string): void {
    delete this.associations.sensors[entityId];
    if (this.getSelectedEntityId() === entityId) {
      this.setSelectedEntity(undefined);
    }
  }

  public deleteAllAssociations(): void {
    this.associations.sensors = {};
    this.setSelectedEntity(undefined);
  }

  public getMarkerStyle(): IModelMarkerStyle {
    return this.markers.sensors.style;
  }

  public setMarkerStyle(style: IModelMarkerStyle): void {
    this.markers.sensors.style = style;
  }

  public getMarkerVisibility(): boolean {
    return this.markers.sensors.visible;
  }

  public setMarkerVisibility(visible: boolean): void {
    this.markers.sensors.visible = visible;
  }

  public getMarkerSize(): number {
    return this.markers.sensors.size;
  }

  public setMarkerSize(size: number): void {
    this.markers.sensors.size = size;
  }

  public getAllAlertPriorityDisplayStyles(): {[key: string]: AlertPriorityMetadataObject} {
    const displayStyles: {[key: string]: AlertPriorityMetadataObject} = {};
    _forEach(AlertPriorityMetadata.getAllMetadata(), (metadata: AlertPriorityMetadataObject) => {
      displayStyles[metadata.id] = this.getAlertPriorityDisplayStyle(metadata.id);
    });
    return displayStyles;
  }

  public getAlertPriorityDisplayStyle(priority: AlertPriority | "default"): AlertPriorityMetadataObject {
    return {
      ...AlertPriorityMetadata.getMetadata(priority),
      ...this.alerts.style[priority.toLowerCase()],
    };
  }

  public setAlertPriorityDisplayStyle(priority: AlertPriority | "default", style: {color: string}): void {
    this.alerts.style[priority.toLowerCase()] = style;
  }

  public hasSelectedEntity(): boolean {
    return !!this.selectedEntityId;
  }

  public getSelectedEntityId(): string | undefined {
    return this.selectedEntityId;
  }

  public getSelectedEntityAssociation(): IModelEntityAssociation | undefined {
    const selectedEntityId = this.getSelectedEntityId();
    if (selectedEntityId && this.associations.sensors[selectedEntityId]) {
      return this.createIModelEntityAssociation(this.associations.sensors[selectedEntityId]);
    }
    return undefined;
  }

  public setSelectedEntity(entityId?: string): void {
    this.selectedEntityId = entityId;
  }

  public setElementMetadata(elementId: string, elementName?: string, elementOrigin?: XYAndZ): void {
    this.elementMetadata[elementId] = { elementId, elementName, elementOrigin };
  }

  private createIModelEntityAssociation(association: StoredIModelEntityAssociation): IModelEntityAssociation {
    const elementMetadata = association.elementId ? this.elementMetadata[association.elementId] : undefined;
    return new IModelEntityAssociation(
      association.entityId,
      "element",
      association.elementId,
      elementMetadata?.elementName,
      elementMetadata?.elementOrigin,
      _map(association.metrics || [], (metricConfiguration: StoredIModelEntityMetricConfiguration) => {
        return new ObservationQuery(
          [association.entityId],
          undefined,
          metricConfiguration.metricId,
          metricConfiguration.unitId,
          metricConfiguration.metricParams
        );
      })
    );
  }

}
