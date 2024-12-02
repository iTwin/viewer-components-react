/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { RootNodeClassnameEnum } from "./GetIcon";

/**
 * @internal
 */
export function formatLabel(Classname: string) {
  switch (RootNodeClassnameEnum[Classname as keyof typeof RootNodeClassnameEnum]) {
    case RootNodeClassnameEnum.iModels:
      return "iModels";
    case RootNodeClassnameEnum.RealityData:
      return "Reality data";
    case RootNodeClassnameEnum.Storage:
      return "Storage";
    case RootNodeClassnameEnum.Forms:
      return "Forms";
    case RootNodeClassnameEnum.Issues:
      return "Issues";
    case RootNodeClassnameEnum.CesiumCuratedContent:
      return "Cesium content";
    case RootNodeClassnameEnum.SensorData:
      return "Sensor data";
    case RootNodeClassnameEnum.GeographicInformationSystem:
      return "Geographic information system";
    case RootNodeClassnameEnum.Construction:
      return "Construction";
    case RootNodeClassnameEnum.Subsurface:
      return "Subsurface";
    default:
      return "Unknown";
  }
}
