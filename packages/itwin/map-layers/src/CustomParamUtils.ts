/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { MapLayerSource } from "@itwin/core-frontend";
import { CustomParamsStorage } from "./CustomParamsStorage";

export class CustomParamUtils  {
  public static setSourceCustomParams(source: MapLayerSource, customParamNames: string[]) {
    const cpStorage = new CustomParamsStorage();
    customParamNames.forEach((paramName) => {
      const customParam = cpStorage.get(paramName);
      if (customParam && customParam.length > 0 && source) {
        if (customParam[0].secret) {
          if (!source.unsavedQueryParams)
            source.unsavedQueryParams = {};
          source.unsavedQueryParams[customParam[0].key] = customParam[0].value;
        } else {
          if (!source.savedQueryParams)
            source.savedQueryParams = {};
          source.savedQueryParams[customParam[0].key] = customParam[0].value;
        }
      }
    });
  }
}
