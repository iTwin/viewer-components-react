/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * Licensed under the MIT License. See LICENSE.md in the project root for license terms.
 *--------------------------------------------------------------------------------------------*/

export * from "./components/Widget";
export { default } from "./components/Widget";
export * from "./api/RealityData";
import { IModelConnection, ViewManager } from "@bentley/imodeljs-frontend";
import { AccessToken } from "@bentley/itwin-client";

/** basic application insights telemetry minimal event */
export interface TelemetryEvent {
  name: string;
  properties?: { [k: string]: any };
}

/** Map of features that can be enabled for the reality data widget */
export interface WidgetFeatures {
  /* allow enhanced configuring of bing map  */
  useBingMapEnhancedSettings?: boolean;
  /* allow configuring elevation */
  bingElevationUseSettings?: boolean;
  /* allow classification */
  classification?: boolean;
  /* CURRENTLY BROKEN: highlights search results in the widget in yellow */
  wantHighlighting?: boolean;
}

/**
 * context of the subscribing iModel app,
 * for custom handling and optional features
 */
export interface PartialAppContext {
  projectId: string;
  iModelConnection: IModelConnection;
  accessToken: AccessToken;
  features?: WidgetFeatures;
  trackEvent?: (e: TelemetryEvent) => void;
  viewManager?: ViewManager;
  handleError?: (e: Error | any) => void;
}

/**
 * sealed version of PartialAppContext with defaults
 * ensured, hence non-optional types
 */
export interface AppContext extends PartialAppContext {
  features: WidgetFeatures;
  trackEvent: (e: TelemetryEvent) => void;
  viewManager: ViewManager;
  handleError: (e: Error | any) => void;
}
