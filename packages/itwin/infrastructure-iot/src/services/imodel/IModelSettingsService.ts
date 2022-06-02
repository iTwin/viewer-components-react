/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import type { SelectionSetEvent } from "@itwin/core-frontend";
import {
  IModelApp,
  MessageBoxIconType,
  MessageBoxType,
  MessageBoxValue,
  NotifyMessageDetails,
  OutputMessagePriority,
} from "@itwin/core-frontend";
import { QueryRowFormat } from "@itwin/core-common";

import type { Observable } from "rxjs";
import { BehaviorSubject } from "rxjs";
import { filter, first, map } from "rxjs/operators";
import { instanceToInstance, instanceToPlain, plainToInstance } from "class-transformer";

import { IModelSettings } from "../../models/imodel/IModelSettingsModel";
import { IModelEntityAssociation } from "../../models/imodel/IModelEntityAssociationModel";
import type { ObservationQuery } from "../../models/observations/ObservationQueryModel";
import type { AuthState } from "../../models/auth/AuthStateModel";
import { AuthService } from "../AuthService";
import { ConfigSettingsService } from "../config-settings/ConfigSettingsService";
import { IModelToolAdminService } from "./IModelToolAdminService";
import { UtilitiesService } from "../UtilitiesService";
import { LoggerService } from "../LoggerService";

class IModelSettingsServiceSingleton {

  private initialized = false;
  private iModelSettings = new BehaviorSubject<IModelSettings | undefined>(undefined);
  private entityAssociationMode = new BehaviorSubject<boolean>(false);

  private iModelSelectEventUnsubscribe?: () => void;

  public iModelSettings$(): Observable<IModelSettings> {
    this.loadSettings();
    return this.iModelSettings.pipe(
      filter((iModelSettings: IModelSettings | undefined) => !!iModelSettings),
      map((iModelSettings: IModelSettings | undefined) => instanceToInstance(iModelSettings))
    ) as Observable<IModelSettings>;
  }

  public setIModelSettings(iModelSettings: IModelSettings, saveToStorage = true): void {
    this.getElementMetadata(iModelSettings)
      .then((newIModelSettings: IModelSettings) => {
        this.iModelSettings.next(newIModelSettings);
        if (saveToStorage) {
          this.saveSettings();
        }
      })
      .catch((error: any) => {
        LoggerService.warn("Error getting iModel element metadata:", error);
        this.iModelSettings.next(iModelSettings);
        if (saveToStorage) {
          this.saveSettings();
        }
      });
  }

  public setEntityAssociation(entityId: string, removeAssociation = false): void {
    const iModelSettings = instanceToInstance(this.iModelSettings.getValue());
    if (iModelSettings) {

      // Disable entity association mode, if it"s active (shouldn"t be)
      this.disableEntityAssociationMode();

      // Check if we"re setting or removing an association
      if (!removeAssociation) {

        // Get reference to current iModel
        const iModelConnection = IModelApp.viewManager.selectedView?.iModel;
        if (iModelConnection) {

          // Add a listener for new selection events
          this.enableEntityAssociationMode();
          this.iModelSelectEventUnsubscribe = iModelConnection.selectionSet.onChanged.addListener(
            (event: SelectionSetEvent) => {
              if (event.set.elements.size === 1) {
                const elementId = Array.from(event.set.elements).pop() as string;
                let association = iModelSettings.getAssociation(entityId);
                if (association) {
                  association.setElementId(elementId);
                } else {
                  association = new IModelEntityAssociation(entityId, "element", elementId);
                }
                iModelSettings.setAssociation(association);
                this.setIModelSettings(iModelSettings);
                this.disableEntityAssociationMode(true);
                LoggerService.log("Associated entity with element:", elementId);
              }
            }
          );

        } else {
          LoggerService.warn("Unable to set entity association: iModel not available");
        }

      } else {
        this.confirmDeleteAssociation(iModelSettings, entityId);
      }

    } else {
      LoggerService.warn("Unable to set entity association: iModel settings not loaded");
    }
  }

  private confirmDeleteAssociation(iModelSettings: IModelSettings, entityId: string): void {
    const confirmMsg = "Are you sure you want to remove this sensor from this iModel?";
    void IModelApp.notifications
      .openMessageBox(MessageBoxType.OkCancel, confirmMsg, MessageBoxIconType.Critical)
      .then((val: MessageBoxValue) => {
        if (val === MessageBoxValue.Ok) {
          iModelSettings.deleteAssociation(entityId);
          this.setIModelSettings(iModelSettings);
        }
      });
  }

  public deleteAllEntityAssociations(): void {
    const iModelSettings = instanceToInstance(this.iModelSettings.getValue());
    if (iModelSettings) {
      const confirmMsg = "Are you sure you want to remove all sensors from this iModel?";
      void IModelApp.notifications
        .openMessageBox(MessageBoxType.OkCancel, confirmMsg, MessageBoxIconType.Critical)
        .then((val: MessageBoxValue) => {
          if (val === MessageBoxValue.Ok) {
            iModelSettings.deleteAllAssociations();
            this.setIModelSettings(iModelSettings);
          }
        });
    } else {
      LoggerService.warn("Unable to delete all associations: iModel settings not loaded");
    }
  }

  public setEntityObservationQuery(entityId: string, observationQueryIndex: number, observationQuery: ObservationQuery): void {
    const iModelSettings = instanceToInstance(this.iModelSettings.getValue());
    if (iModelSettings) {
      const association = iModelSettings.getAssociation(entityId);
      if (association) {
        association.setObservationQuery(observationQueryIndex, observationQuery);
        iModelSettings.setAssociation(association);
        this.setIModelSettings(iModelSettings);
      } else {
        LoggerService.warn("Unable to set entity observation query: entity association not found");
      }
    } else {
      LoggerService.warn("Unable to set entity observation query: iModel settings not loaded");
    }
  }

  public addEntityObservationQuery(entityId: string, observationQuery: ObservationQuery): void {
    const iModelSettings = instanceToInstance(this.iModelSettings.getValue());
    if (iModelSettings) {
      const association = iModelSettings.getAssociation(entityId);
      if (association) {
        association.addObservationQuery(observationQuery);
        iModelSettings.setAssociation(association);
        this.setIModelSettings(iModelSettings);
      } else {
        LoggerService.warn("Unable to add entity observation query: entity association not found");
      }
    } else {
      LoggerService.warn("Unable to add entity observation query: iModel settings not loaded");
    }
  }

  public deleteEntityObservationQuery(entityId: string, index: number): void {
    const iModelSettings = instanceToInstance(this.iModelSettings.getValue());
    if (iModelSettings) {
      const association = iModelSettings.getAssociation(entityId);
      if (association) {
        association.deleteObservationQuery(index);
        iModelSettings.setAssociation(association);
        this.setIModelSettings(iModelSettings);
      } else {
        LoggerService.warn("Unable to delete entity observation query: entity association not found");
      }
    } else {
      LoggerService.warn("Unable to delete entity observation query: iModel settings not loaded");
    }
  }

  public isEntitySelected(entityId: string): boolean {
    const iModelSettings: IModelSettings | undefined = this.iModelSettings.getValue();
    return iModelSettings?.getSelectedEntityId() === entityId;
  }

  public setSelectedEntity(entity?: any, elementId?: string): void {
    const iModelSettings: IModelSettings | undefined = this.iModelSettings.getValue();
    if (iModelSettings) {
      if (iModelSettings.getSelectedEntityId() !== entity?.getId()) {
        iModelSettings.setSelectedEntity(entity?.getId());
        this.setIModelSettings(iModelSettings, false);
        if (!entity) {
          this.clearSelectedElements();
        }
      }
    }
    if (elementId) {
      UtilitiesService.centerViewOnElement(elementId);
    }
  }

  public isEntityAssociationModeActive(): boolean {
    return this.entityAssociationMode.getValue();
  }

  private loadSettings(): void {
    if (!this.initialized) {

      this.initialized = true;

      // Get current auth state because we need the project id
      AuthService.authState$()
        .pipe(
          filter((authState: AuthState | null) => !!authState),
          first()
        )
        .subscribe((authState: AuthState | null) => {
          if (authState) {
            ConfigSettingsService.getConfigSettings$(authState.getProjectId())
              .subscribe({
                next: ((data: {[key: string]: any }) => {
                  LoggerService.log("Loaded iModel settings:", data);
                  this.setIModelSettings(plainToInstance(IModelSettings, data), false);
                }),
                error: (() => {
                  this.setIModelSettings(new IModelSettings(), false);
                }),
              });
          } else {
            LoggerService.warn("Error saving iModel settings: Auth State not available");
            this.setIModelSettings(new IModelSettings(), false);
          }
        });
    }
  }

  private saveSettings(): void {

    // Get current auth state because we need the project id
    AuthService.authState$()
      .pipe(
        filter((authState: AuthState | null) => !!authState),
        first()
      )
      .subscribe((authState: AuthState | null) => {
        if (authState) {
          const newSettings = instanceToPlain(this.iModelSettings.getValue());
          ConfigSettingsService.saveConfigSettings$(authState.getProjectId(), newSettings)
            .subscribe({
              next: (() => {
                LoggerService.log("iModel settings saved:", this.iModelSettings.getValue());
              }),
            });
        } else {
          LoggerService.warn("Error saving iModel settings: Auth State not available");
        }
      });
  }

  private async getElementMetadata(iModelSettings: IModelSettings): Promise<IModelSettings> {

    const iModelConnection = IModelApp.viewManager.selectedView?.iModel;

    // First, we need to check if there is missing element metadata
    const newElementIds = iModelSettings.getAssociatedElements(true);
    if (newElementIds.length && iModelConnection) {

      // Construct SQL query for the GeometricElement3d collection
      // This is the parent collection for all 3D elements in the iModel
      const query = `
                SELECT ECInstanceId, ECClassId, CodeValue, UserLabel, Origin 
                FROM bis.GeometricElement3d 
                WHERE ECInstanceId IN (${newElementIds.join(",")})`;

      // Perform the query against the iModel, save results in our settings
      LoggerService.log("Retrieving iModel element metadata with query:", query.trim());
      const queryResults = iModelConnection.query(
        query,
        undefined,
        { rowFormat: QueryRowFormat.UseJsPropertyNames }
      );
      for await (const element of queryResults) {
        iModelSettings.setElementMetadata(element.id, element.id, element.origin);
      }

      // Resolve updated settings
      return iModelSettings;

    } else {
      return iModelSettings;
    }
  }

  private enableEntityAssociationMode(): void {

    // Switch to selection tool
    IModelToolAdminService.activateSelectTool();

    // Show message to user
    IModelApp
      .notifications
      .outputMessage(
        new NotifyMessageDetails(
          OutputMessagePriority.Info,
          "Select an iModel element to associate with this sensor."
        )
      );

    // Update local state
    this.entityAssociationMode.next(true);
  }

  private disableEntityAssociationMode(delaySelectionClear = false): void {

    // Clear any selected elements
    this.clearSelectedElements(delaySelectionClear);

    // Unsubscribe from listening to iModel element select events
    if (this.iModelSelectEventUnsubscribe) {
      this.iModelSelectEventUnsubscribe();
      this.iModelSelectEventUnsubscribe = undefined;
    }

    // Update local state
    this.entityAssociationMode.next(false);
  }

  private clearSelectedElements(delaySelectionClear = false): void {
    const iModelConnection = IModelApp.viewManager.selectedView?.iModel;
    if (iModelConnection) {
      setTimeout(() => {
        iModelConnection.selectionSet.emptyAll();
      }, delaySelectionClear ? 1000 : 0);
    }
  }

}

export const IModelSettingsService: IModelSettingsServiceSingleton = new IModelSettingsServiceSingleton();
