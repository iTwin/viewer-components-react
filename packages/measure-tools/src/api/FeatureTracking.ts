/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { BeUiEvent, GuidString, Logger } from "@bentley/bentleyjs-core";
import { AuthorizedFrontendRequestContext, IModelApp, IModelConnection } from "@bentley/imodeljs-frontend";
import { TelemetryEvent } from "@bentley/telemetry-client";
import { UiFramework } from "@bentley/ui-framework";
import { MeasureToolsLoggerCategory } from "./MeasureToolsLoggerCategory";

/** Each feature has a human-readable name that should be unique, but also a GUID. */
export interface Feature {
  name: string;
  guid: GuidString;
  metaData?: Map<string, any>;
}

/** Feature tracking helper for MeasureTools. Can control if features should be tracked and hook into the notification (either via an event OR supply a subclass of FeatureTrackingManager to the
 * IModelApp, it isn't recommended to do both).
 */
export class FeatureTracking {
  private static _enabled: boolean = true;

  /** Feature tracking notiication event. */
  public static readonly onFeature: BeUiEvent<Feature> = new BeUiEvent<Feature>();

  /**
   * Gets if the feature tracking is enabled or not.
   */
  public static get isEnabled(): boolean {
    return FeatureTracking._enabled;
  }

  /**
   * Starts feature tracking events.
   */
  public static start() {
    FeatureTracking._enabled = true;
  }

  /**
   * Stops feature tracking events.
   */
  public static stop() {
    FeatureTracking._enabled = false;
  }

  /**
   * Emits an event that the specified feature was activated. Also calls into the IModelApp's [[FeatureTrackingManager]] if available.
   * @param feature Feature that was activated.
   */
  public static notifyFeature(feature: Feature) {
    if (!FeatureTracking._enabled)
      return;

    this.onFeature.emit(feature);

    const iModelConnection = this.getUiFameworkIModel();

    // tslint:disable-next-line:no-floating-promises
    FeatureTracking.postTelemetry(feature, iModelConnection);
  }

  private static async postTelemetry(feature: Feature, iModelConnection: IModelConnection | undefined) {
    if (!IModelApp.authorizationClient || !IModelApp.authorizationClient.isAuthorized)
      return;

    try {
      const context = await AuthorizedFrontendRequestContext.create();
      let imodelId, changesetId, contextId;
      if (iModelConnection) {
        imodelId = iModelConnection.iModelId;
        changesetId = iModelConnection.changeSetId;
        contextId = iModelConnection.contextId;
      }

      const evt = new TelemetryEvent(feature.name, feature.guid, contextId, imodelId, changesetId, undefined, feature.metaData);
      await IModelApp.telemetry.postTelemetry(context, evt);
    } catch (e) {
      Logger.logException(MeasureToolsLoggerCategory.Root, e);
    }
  }

  /**
   * Emits an event that the specified feature was activated with the specified toggled state. Also calls into the IModelApp's [[FeatureTrackingManager]] if available.
   * @param feature Feature that was activated.
   * @param isOn current toggle state of the feature. This is added as metadata.
   */
  public static notifyToggledFeature( feature: Feature, isOn: boolean) {
    this.notifyFeature(createToggledFeature(feature.name, feature.guid, isOn, feature.metaData, true));
  }

  /**
   * Emits an event that the specified feature was activated. Also calls into the IModelApp's [[FeatureTrackingManager]] if available.
   * @param featureName name of the feature that was activated.
   * @param featureGuid guid of the feature that was activated.
   * @param metaData optional metadata for the feature.
   */
  public static notifyFeatureByName(featureName: string, featureGuid: GuidString, metaData?: Map<string, any>) {
    this.notifyFeature( { name: featureName, guid: featureGuid, metaData });
  }

  /**
   * Emits an event that the specified feature was activated with the specified toggled state. Also calls into the IModelApp's [[FeatureTrackingManager]] if available.
   * @param featureName name of the feature that was activated.
   * @param featureGuid guid of the feature that was activated.
   * @param isOn current toggle state of the feature. This is added as metadata.
   * @param metaData optional additional metadata for the feature.
   */
  public static notifyToggledFeatureByName(featureName: string, featureGuid: GuidString, isOn: boolean,  metaData?: Map<string, any>) {
    this.notifyFeature(createToggledFeature(featureName, featureGuid, isOn, metaData, true));
  }

  private static getUiFameworkIModel(): IModelConnection | undefined {
    // Apparently UiFramework errors if not initialized, because it's redux store hasn't been initialized,
    // but it's accessor throws an exception if undefined so there doesn't seem to be an easy way to check if it's been initialized...
    try {
      return UiFramework.getIModelConnection();
    } catch {
      return undefined;
    }
  }
}

/** State for a feature that can be toggled on/off */
export enum ToggledState {
  On = "on",
  Off = "off",
}

/** Use this to create a feature that has metadata for a toggled "on/off" state. */
export function createToggledFeature(featureName: string, featureGuid: GuidString, isOn: boolean, metaDataMap?: Map<string, any>, copyMetaData?: boolean): Feature {
  const metaData = (metaDataMap) ? ((copyMetaData) ? new Map<string, any>(metaDataMap) : metaDataMap) : new Map<string, any>();
  metaData.set("toggled", (isOn) ? ToggledState.On : ToggledState.Off);
  return { name: featureName, guid: featureGuid, metaData };
}

// tslint:disable:variable-name

// Note: CRT_ prefix is legacy since these features were originally from the Civil-ReviewTools packages. Newly defined features do not need to use this prefix, and can use MST_ for MeaSure-Tools
export class MeasureToolsFeatures {
  // Tools
  public static get Tools_ClearMeasurements(): Feature { return { name: "CRT_Tools_ClearMeasurements", guid: "5838fd80-87e8-41a1-a813-15bcdc882ad1" }; }
  public static get Tools_ToggleDisplayMeasurementAxes(): Feature { return { name: "CRT_Tools_ToggleDisplayMeasurementAxes", guid: "d8a31a35-16d8-40c3-a5ea-1159ea644d7c" }; }
  public static get Tools_MeasureArea(): Feature { return { name: "CRT_Tools_MeasureArea", guid: "7000640d-c362-4533-9f60-3fc4e72af81f" }; }
  public static get Tools_MeasureDistance(): Feature { return { name: "CRT_Tools_MeasureDistance", guid: "10e474ee-9af8-4262-a505-77c9d896b065" }; }
  public static get Tools_MeasureLocation(): Feature { return { name: "CRT_Tools_MeasureLocation", guid: "6230e620-ffc2-4f7f-88d7-8652ae8cf91f" }; }
  public static get Tools_MeasureAngle(): Feature { return { name: "MST_Tools_MeasureAngle", guid: "19febcb9-24e7-49ee-980b-c2bb6a5dedef"}; }
  public static get Tools_MeasureRadius(): Feature { return { name: "MST_Tools_MeasureRadius", guid: "0ab34c10-2ab9-4982-9ed9-2760e6e455bd"}; }
  public static get Tools_MeasurePerpendicular(): Feature { return { name: "MST_Tools_MeasurePerpendicular", guid: "014ad558-3ad3-4c4d-bdb7-004783fdc149" }; }

  // Action toolbar
  public static get MeasurementActionsToolbar_Open(): Feature { return { name: "CRT_MeasurementActionsToolbar_Open", guid: "8d92174a-9ccc-45a2-8638-4c9f66294022" }; }
  public static get MeasurementActions_Delete(): Feature { return { name: "CRT_MeasurementActions_Delete", guid: "269c820b-1361-4401-b711-ec4eaf333aff" }; }
  public static get MeasurementActions_Lock(): Feature { return { name: "CRT_MeasurementActions_Lock", guid: "e03e9d2a-e63b-4ea8-805d-59c1dbf94f86" }; }
  public static get MeasurementActions_ToggleDisplayAxes(): Feature { return { name: "CRT_MeasurementActions_ToggleDisplayAxes", guid: "ee61e68f-14d5-4d47-9fba-e8334d9b9097" }; }
  public static get MeasurementActions_ToggleDisplayLabels(): Feature { return { name: "CRT_MeasurementActions_ToggleDisplayLabels", guid: "3ee3fcd7-c158-481f-96e7-2f0907551357" }; }
}
