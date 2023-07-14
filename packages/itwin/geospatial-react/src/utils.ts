/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import type { Id64String } from "@itwin/core-bentley";
import type { ContextRealityModelProps } from "@itwin/core-common";
import { RealityDataFormat } from "@itwin/core-common";
import type { IModelConnection } from "@itwin/core-frontend";
import { RealityDataSource } from "@itwin/core-frontend";
import { CoreTools, IModelApp, QuantityType, SpatialModelState } from "@itwin/core-frontend";

export function convertDDToDMS(degrees: number, isLatitude: boolean) {
  const radians = (degrees * Math.PI) / 180;
  const latLongFormatterSpec = IModelApp.quantityFormatter.findFormatterSpecByQuantityType(QuantityType.LatLong);
  const formatted = IModelApp.quantityFormatter.formatQuantity(Math.abs(radians), latLongFormatterSpec);
  let prompt: string;
  if (isLatitude) {
    prompt = radians < 0 ? "Measure.Labels.S" : "Measure.Labels.N";
  } else {
    prompt = radians < 0 ? "Measure.Labels.W" : "Measure.Labels.E";
  }
  return `${formatted}${CoreTools.translate(prompt)}`;
}

/**
 * Gets all the attached reality data iModels.
 *
 * This is a refactored version of RealityDataManager.getAttachedRealityDataModelInfoSet
 *
 * @param iModelConnection The connection to query
 * @returns An array of objects (ContextRealityModelProps & modelId) containing the reality data models in the IModelConnection.
 */
export function getAttachedRealityDataModels(iModelConnection: IModelConnection) {
  const realityModels = new Array<
    ContextRealityModelProps & {
      modelId: Id64String;
    }
  >();
  // The original code from RealityDataManager used iModel.models.queryProps() but that's aync and we can
  // quickly loop through all the models looking for SpatialModelState instead.
  for (const modelState of iModelConnection.models) {
    if (modelState.className !== SpatialModelState.className) {
      continue;
    }
    const modelProps = modelState.toJSON().jsonProperties;
    if (modelProps) {
      const orbitGtBlob = modelProps.tilesetUrl?.orbitGtBlob ?? modelProps.orbitGtBlob;
      const attachmentUrl = orbitGtBlob?.rdsUrl ?? modelProps.tilesetUrl;
      if (attachmentUrl) {
        const rdSourceKey = RealityDataSource.createKeyFromUrl(
          attachmentUrl,
          undefined,
          orbitGtBlob ? RealityDataFormat.OPC : RealityDataFormat.ThreeDTile
        );
        realityModels.push({
          rdSourceKey,
          realityDataId: rdSourceKey.id,
          tilesetUrl: attachmentUrl,
          name: modelState.name,
          orbitGtBlob,
          modelId: modelState.id,
        });
      }
    }
  }
  return realityModels;
}
