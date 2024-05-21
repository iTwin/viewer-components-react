/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { MapLayerSource } from "@itwin/core-frontend";
import { CustomParamsStorage } from "./CustomParamsStorage";
import { CustomParamItem } from "./ui/Interfaces";

export class CustomParamUtils  {
  public static setSourceCustomParams(source: MapLayerSource, customParamNames: string[]) {
    const cpStorage = new CustomParamsStorage();
    customParamNames.forEach((paramName) => {
      const paramFromStorage = cpStorage.get(paramName);
      let customParam: CustomParamItem | undefined;
      if (Array.isArray(paramFromStorage)) {
        if (paramFromStorage.length > 0)
          customParam = paramFromStorage[0];
      } else {
        customParam =paramFromStorage;
      }

      if (customParam && source) {
        if (customParam.secret) {
          if (!source.unsavedQueryParams)
            source.unsavedQueryParams = {};
          source.unsavedQueryParams[customParam.key] = customParam.value;
        } else {
          if (!source.savedQueryParams)
            source.savedQueryParams = {};
          source.savedQueryParams[customParam.key] = customParam.value;
        }
      }
    });
  }
}
