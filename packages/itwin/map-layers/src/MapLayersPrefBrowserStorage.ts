/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { PreferencesBrowserStorage } from "./PreferencesBrowserStorage";

export class MapLayersPrefBrowserStorage extends PreferencesBrowserStorage {
  constructor() {
    super(
      "itwinjs.mapLayers",
      { throwOnDeleteMissingKey: true }, // 'MapLayerPreferences.replaceSource' expect 'delete' to throw when there is no match for the provided key.
    );
  }
}
