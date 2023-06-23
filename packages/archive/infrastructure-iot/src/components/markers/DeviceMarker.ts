/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import ReactDOM from "react-dom";

import type { XAndY, XYAndZ } from "@itwin/core-geometry";
import { Point2d } from "@itwin/core-geometry";
import { getCssVariable } from "@itwin/core-react";
import { ColorDef, FeatureOverrideType } from "@itwin/core-common";
import type { BeButtonEvent} from "@itwin/core-frontend";
import { EmphasizeElements, IModelApp, Marker } from "@itwin/core-frontend";

import type { Subscription } from "rxjs";
import { get as _get } from "lodash";

import { IModelMarkerStyle } from "../../enums/imodel/IModelMarkerStyleEnum";
import type { IModelEntityAssociation } from "../../models/imodel/IModelEntityAssociationModel";
import type { SensorData } from "../../models/entities/SensorDataInterface";
import { AlertPriorityMetadata } from "../../models/alerts/AlertPriorityMetadataModel";
import type { AlertPriorityMetadataObject } from "../../models/alerts/AlertPriorityMetadataObjectInterface";
import { EntityDataService } from "../../services/entities/EntityDataService";
import { IModelSettingsService } from "../../services/imodel/IModelSettingsService";
import { IModelToolAdminService } from "../../services/imodel/IModelToolAdminService";
import { UtilitiesService } from "../../services/UtilitiesService";

import { DeviceMarkerTooltip } from "./DeviceMarkerTooltip";

export class DeviceMarker extends Marker {

  // Note: component theoretically designed to handle multiple entities eventually
  // but only 1 is currently retrieved/shown/supported

  private elementId: string;

  private entityAssociations: IModelEntityAssociation[] = [];
  private entityData: SensorData[] = [];
  private tooltipHtmlElement: HTMLElement;

  private markerVisibility?: boolean;
  private markerStyle?: IModelMarkerStyle;
  private markerColor?: string;
  private markerOutlineColor = "#ffffff";
  private markerOutlineColorSelected = getCssVariable("--buic-foreground-primary");

  private alertPriorityDisplayStyles?: {[key: string]: AlertPriorityMetadataObject};

  private dataSubscription?: Subscription;

  constructor(
    elementId: string,
    location: XYAndZ,
    entityAssociations: IModelEntityAssociation[],
    visibility: boolean,
    style: IModelMarkerStyle,
    size: XAndY,
    alertPriorityDisplayStyles: {[key: string]: AlertPriorityMetadataObject}
  ) {

    super(location, size);

    // Save element id and entity associations
    this.elementId = elementId;
    this.entityAssociations = entityAssociations;

    // Save initial marker display options
    this.markerVisibility = visibility;
    this.markerStyle = style;
    this.visible = false;
    this.alertPriorityDisplayStyles = alertPriorityDisplayStyles;

    // Create a new HTML element for the tooltip component
    this.tooltipHtmlElement = document.createElement("div");

    // Retrieve entity data and subscribe to changes
    this.dataSubscription = EntityDataService.getDataForSensor$(entityAssociations[0].getEntityId())
      .subscribe({
        next: (sensorData: SensorData) => {

          // Show marker after the first successful data response
          if (!this.entityData.length) {
            this.visible = !!this.markerVisibility && this.markerStyle !== IModelMarkerStyle.ELEMENT;
          }

          // Update marker display
          this.entityData[0] = sensorData;
          this.updateMarkerColor();
          this.updateTooltipComponent();
        },
        error: () => { },
      });
  }

  public override onMouseButton(event: BeButtonEvent): boolean {
    if (event.isDown) {
      this.selectAssociatedEntity();
    }
    return true;
  }

  public selectAssociatedEntity(): void {
    if (this.entityData.length) {
      IModelSettingsService.setSelectedEntity(this.entityData[0].sensor);
    }
  }

  public getElementId(): string {
    return this.elementId;
  }

  public getEntityAssociations(): IModelEntityAssociation[] {
    return this.entityAssociations;
  }

  public setMarkerVisibility(visibility: boolean): void {
    this.markerVisibility = visibility;
    if (this.entityData.length) {
      this.visible = !!this.markerVisibility && this.markerStyle !== IModelMarkerStyle.ELEMENT;
      this.updateElementStyle();
    }
  }

  public setMarkerStyle(style: IModelMarkerStyle): void {
    this.markerStyle = style;
    if (this.entityData.length) {
      this.visible = !!this.markerVisibility && this.markerStyle !== IModelMarkerStyle.ELEMENT;
      this.updateElementStyle();
    }
  }

  public setMarkerSize(size: XAndY): void {
    this.size = Point2d.createFrom(size);
  }

  public setAlertPriorityDisplayStyles(alertPriorityDisplayStyles: {[key: string]: AlertPriorityMetadataObject}) {
    this.alertPriorityDisplayStyles = alertPriorityDisplayStyles;
    if (this.entityData.length) {
      this.updateMarkerColor();
      this.updateTooltipComponent();
    }
  }

  public override drawFunc(ctx: CanvasRenderingContext2D) {
    ctx.beginPath();
    ctx.strokeStyle = IModelSettingsService.isEntitySelected(this.entityAssociations[0].getEntityId()) ?
      this.markerOutlineColorSelected : this.markerOutlineColor;
    ctx.fillStyle = this.markerColor as string;
    ctx.lineWidth = 1.5;
    ctx.arc(0, 0, this.size.x / 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }

  public destroy(): void {
    if (this.dataSubscription) {
      this.dataSubscription.unsubscribe();
    }
    this.clearElementColor();
    IModelToolAdminService.setTooltipOverride(this.elementId);
  }

  private updateMarkerColor(): void {
    const newMarkerColor = this.getActiveAlertPriorityDisplayStyle().color;
    if (newMarkerColor !== this.markerColor) {
      this.markerColor = newMarkerColor;
      this.updateElementStyle();
      UtilitiesService.invalidateDecorations();
    }
  }

  private updateElementStyle(): void {
    if (this.markerVisibility && this.markerStyle === IModelMarkerStyle.ELEMENT) {
      this.setElementColor();
      if (this.title) {
        IModelToolAdminService.setTooltipOverride(this.elementId, this.tooltipHtmlElement);
      }
    } else {
      this.clearElementColor();
      IModelToolAdminService.setTooltipOverride(this.elementId);
    }
  }

  private setElementColor(): void {
    const viewPort = IModelApp.viewManager.selectedView;
    if (viewPort) {
      const emphasizeElements = EmphasizeElements.getOrCreate(viewPort);
      if (this.markerStyle === IModelMarkerStyle.ELEMENT && this.markerColor) {
        emphasizeElements.overrideElements(
          [this.elementId],
          viewPort,
          ColorDef.create(this.markerColor),
          FeatureOverrideType.ColorOnly,
          false
        );
      }
    }
  }

  private clearElementColor(): void {
    const viewPort = IModelApp.viewManager.selectedView;
    if (viewPort) {
      const emphasizeElements = EmphasizeElements.getOrCreate(viewPort);
      emphasizeElements.clearOverriddenElements(viewPort, [this.elementId]);
    }
  }

  private updateTooltipComponent(): void {
    if (this.entityData[0] && this.entityData[0].sensor) {
      if (!this.title) {
        this.title = this.tooltipHtmlElement;
        this.updateElementStyle();
      }
      ReactDOM.render(
        DeviceMarkerTooltip({
          data: this.entityData[0],
          alertPriorityDisplayStyle: this.getActiveAlertPriorityDisplayStyle(),
        }),
        this.tooltipHtmlElement
      );
    }
  }

  private getActiveAlertPriorityDisplayStyle(): AlertPriorityMetadataObject {
    const activeAlert = _get(this, "entityData[0].alerts[0]");
    const alertPriorityId = activeAlert ? activeAlert.getPriority() : "default";
    return this.alertPriorityDisplayStyles && this.alertPriorityDisplayStyles[alertPriorityId] ?
      this.alertPriorityDisplayStyles[alertPriorityId] :
      AlertPriorityMetadata.getMetadata(alertPriorityId);
  }

}
