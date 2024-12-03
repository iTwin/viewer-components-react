/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { ITwinRepositoryType } from "./RepositoriesType";

/**
 * @internal
 */
export function formatLabel(repositoryClassname: string) {
  switch (ITwinRepositoryType[repositoryClassname as keyof typeof ITwinRepositoryType]) {
    case ITwinRepositoryType.iModels:
      return "iModels";
    case ITwinRepositoryType.RealityData:
      return "Reality data";
    case ITwinRepositoryType.Storage:
      return "Storage";
    case ITwinRepositoryType.Forms:
      return "Forms";
    case ITwinRepositoryType.Issues:
      return "Issues";
    case ITwinRepositoryType.CesiumCuratedContent:
      return "Cesium content";
    case ITwinRepositoryType.SensorData:
      return "Sensor data";
    case ITwinRepositoryType.GeographicInformationSystem:
      return "Geographic information system";
    case ITwinRepositoryType.Construction:
      return "Construction";
    case ITwinRepositoryType.Subsurface:
      return "Subsurface";
    default:
      return "Unknown";
  }
}
