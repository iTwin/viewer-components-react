/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { BrowserStorage } from "./BrowserStorage";
import { ApiKeyItem } from "./ui/Interfaces";

export class ApiKeysStorage extends BrowserStorage<ApiKeyItem>  {
  constructor() {
    super({itemKeyName: "itwinjs.mapLayers.apiKeys"});
  }
}
