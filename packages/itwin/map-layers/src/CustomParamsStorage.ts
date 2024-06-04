/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
import { BrowserStorage } from "./BrowserStorage";
import type { CustomParamItem } from "./ui/Interfaces";

export class CustomParamsStorage extends BrowserStorage<CustomParamItem> {
  constructor() {
    super({ itemKeyName: "itwinjs.mapLayers.customParams" });
  }
}
