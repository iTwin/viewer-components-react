/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { BrowserStorage } from "./BrowserStorage";
import { CustomParamsMappingItem } from "./ui/Interfaces";

export class CustomParamsMappingStorage extends BrowserStorage<CustomParamsMappingItem>  {
  constructor() {
    super({itemKeyName: "itwinjs.mapLayers.customParamsMapping"});
  }
}
