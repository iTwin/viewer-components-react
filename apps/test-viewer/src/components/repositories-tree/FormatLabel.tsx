/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { ITwinRepositoryType } from "./RepositoriesType";

/**
 * @internal
 */
export function formatLabel(iTwinRepositoryType: ITwinRepositoryType) {
  switch (iTwinRepositoryType) {
    case "iModels":
      return "iModels";
    case "RealityData":
      return "Reality data";
    case "Storage":
      return "Storage";
    case "Forms":
      return "Forms";
    case "Issues":
      return "Issues";
    case "CesiumCuratedContent":
      return "Cesium content";
    case "SensorData":
      return "Sensor data";
    case "GeographicInformationSystem":
      return "Geographic information system";
    case "Construction":
      return "Construction";
    case "Subsurface":
      return "Subsurface";
    default:
      return "Unknown";
  }
}
