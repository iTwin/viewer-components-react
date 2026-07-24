/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
import { GoogleMaps } from "@itwin/map-layers-formats";

/**
 * Creates default Google Maps base layers settings.
 */
export const createDefaultGoogleMapsBaseMaps = () => [
    GoogleMaps.createBaseLayerSettings({mapType: "satellite", language: "en", region: "US"}),
    GoogleMaps.createBaseLayerSettings({mapType: "satellite", layerTypes: ["layerRoadmap"], language: "en", region: "US"}),
    GoogleMaps.createBaseLayerSettings({mapType: "roadmap", language: "en", region: "US"}),
  ];
