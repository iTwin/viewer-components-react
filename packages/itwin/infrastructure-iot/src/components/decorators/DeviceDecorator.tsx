/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { XYAndZ } from "@itwin/core-geometry";
import { DecorateContext, Decorator, IModelApp, SelectionSetEvent } from "@itwin/core-frontend";

import { filter as _filter, find as _find, forEach as _forEach, isEqual as _isEqual, map as _map } from "lodash";

import { IModelMarkerStyle } from "../../enums/imodel/IModelMarkerStyleEnum";
import { IModelSettings } from "../../models/imodel/IModelSettingsModel";
import { IModelEntityAssociation } from "../../models/imodel/IModelEntityAssociationModel";
import { AlertPriorityMetadataObject } from "../../models/alerts/AlertPriorityMetadataObjectInterface";
import { IModelSettingsService } from "../../services/imodel/IModelSettingsService";
import { DeviceMarker } from "../markers/DeviceMarker";
import { UtilitiesService } from "../../services/UtilitiesService";
import { LoggerService } from "../../services/LoggerService";

export class DeviceDecorator implements Decorator {

  private markerSet: DeviceMarker[] = [];

  private markerVisibility?: boolean;
  private markerStyle?: IModelMarkerStyle;
  private markerSize?: number;

  private alertPriorityDisplayStyles?: {[key: string]: AlertPriorityMetadataObject};

  private selectedEntityId?: string;

  constructor() {

    // Subscribe to iModelSettings changes to add/remove sensor markers and update their display styles
    IModelSettingsService.iModelSettings$()
      .subscribe((iModelSettings: IModelSettings) => {

        let markersChanged = false;

        const elementsWithAssociations = iModelSettings.getAssociatedElements();
        const alertPriorityDisplayStyles = iModelSettings.getAllAlertPriorityDisplayStyles();

        // First, we delete existing markers if their association was removed completely
        // or if the associated element changed
        this.markerSet = _filter(this.markerSet, (m: DeviceMarker) => {

          let removeMarker = false;

          // Filter out any markers for elements with no associations
          if (elementsWithAssociations.indexOf(m.getElementId()) < 0) {
            removeMarker = true;
          }

          // Next change for any element markers, who's entity ids changed
          // for example, when switching an entity's associated element
          if (!removeMarker) {
            const currentEntityIds = _map(m.getEntityAssociations(), (a: IModelEntityAssociation) => {
              return a.getEntityId();
            });
            const newEntityIds = _map(
              iModelSettings.getAssociations(m.getElementId()),
              (a: IModelEntityAssociation) => {
                return a.getEntityId();
              }
            );
            removeMarker = !_isEqual(currentEntityIds.sort(), newEntityIds.sort());
          }

          // If marker being removed, destroy it and set changed flag
          if (removeMarker) {
            m.destroy();
            markersChanged = true;
          }

          return !removeMarker;
        });

        // Next, add any markers not present in marker set
        const elementsWithMarkers = _map(this.markerSet, (m: DeviceMarker) => m.getElementId());
        _forEach(elementsWithAssociations, (elementId: string) => {
          if (elementsWithMarkers.indexOf(elementId) < 0) {
            const elementAssociations = iModelSettings.getAssociations(elementId);
            if (elementAssociations[0].getElementOrigin()) {
              const deviceMarker = new DeviceMarker(
                elementAssociations[0].getElementId() as string,
                elementAssociations[0].getElementOrigin() as XYAndZ,
                elementAssociations,
                iModelSettings.getMarkerVisibility(),
                iModelSettings.getMarkerStyle(),
                { x: iModelSettings.getMarkerSize(), y: iModelSettings.getMarkerSize() },
                alertPriorityDisplayStyles,
              );
              this.markerSet.push(deviceMarker);
              markersChanged = true;
            } else {
              LoggerService.warn("Unable to add marker due to missing origin:", elementAssociations[0]);
            }
          }
        });

        // Update global marker visibility
        if (!this.markerVisibility || this.markerVisibility !== iModelSettings.getMarkerVisibility()) {
          markersChanged = true;
          this.markerVisibility = iModelSettings.getMarkerVisibility();
          _forEach(this.markerSet, (m: DeviceMarker) => {
            m.setMarkerVisibility(iModelSettings.getMarkerVisibility());
          });
        }

        // Update existing marker style based on settings
        if (!this.markerStyle || this.markerStyle !== iModelSettings.getMarkerStyle()) {
          markersChanged = true;
          this.markerStyle = iModelSettings.getMarkerStyle();
          _forEach(this.markerSet, (m: DeviceMarker) => {
            m.setMarkerStyle(iModelSettings.getMarkerStyle());
          });
        }

        // Update existing marker sizes based on settings
        if (!this.markerSize || this.markerSize !== iModelSettings.getMarkerSize()) {
          markersChanged = true;
          this.markerSize = iModelSettings.getMarkerSize();
          _forEach(this.markerSet, (m: DeviceMarker) => {
            m.setMarkerSize({x: iModelSettings.getMarkerSize(), y: iModelSettings.getMarkerSize()});
          });
        }

        // Update alert priority display styles for markers
        if (
          !this.alertPriorityDisplayStyles ||
          !_isEqual(this.alertPriorityDisplayStyles, alertPriorityDisplayStyles)
        ) {
          markersChanged = true;
          this.alertPriorityDisplayStyles = alertPriorityDisplayStyles;
          _forEach(this.markerSet, (m: DeviceMarker) => {
            m.setAlertPriorityDisplayStyles(alertPriorityDisplayStyles);
          });
        }

        // Check if selected entity has changed
        if (!this.selectedEntityId || this.selectedEntityId !== iModelSettings.getSelectedEntityId()) {
          markersChanged = true;
          this.selectedEntityId = iModelSettings.getSelectedEntityId();
        }

        // When the markers change we notify the ViewManager to remove the existing decorations and redraw them
        if (markersChanged) {
          UtilitiesService.invalidateDecorations();
        }

      });

    // Subscribe to iModel selection events and select sensor associated with each element if in "element" marker mode
    const iModelConnection = IModelApp.viewManager.selectedView?.iModel;
    if (iModelConnection) {
      iModelConnection.selectionSet.onChanged.addListener(
        (event: SelectionSetEvent) => {
          if (event.set.elements.size === 1 && !IModelSettingsService.isEntityAssociationModeActive()) {
            const elementId = Array.from(event.set.elements).pop() as string;
            if (this.markerStyle === IModelMarkerStyle.ELEMENT) {
              const elementMarker = _find(this.markerSet, (m: DeviceMarker) => m.getElementId() === elementId);
              if (elementMarker) {
                elementMarker.selectAssociatedEntity();
              }
            }
          }
        }
      );
    } else {
      LoggerService.warn("Unable to subscribe to iModel selection events: iModel not available");
    }
  }

  public decorate(context: DecorateContext): void {
    if (this.markerVisibility) {
      this.markerSet.forEach((marker: DeviceMarker) => {
        marker.addDecoration(context);
      });
    }
  }

}
