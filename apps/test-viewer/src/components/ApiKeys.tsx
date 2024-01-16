/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

export class ApiKeys {
  public static get BingMapsKey() {
    return process.env.IMJS_BING_MAPS_KEY ?? "";
  }

  public static get CesiumKey() {
    return process.env.IMJS_CESIUM_ION_KEY ?? "";
  }
}
