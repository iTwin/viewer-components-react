/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { BrowserStorage } from "./BrowserStorage";
import { ApiKeyMappingItem } from "./ui/Interfaces";

export class ApiKeysStorage extends BrowserStorage<ApiKeyMappingItem>  {
  constructor() {
    super({itemKeyName: "itwinjs.mapLayers.apiKeyMapping"});
  }
}
