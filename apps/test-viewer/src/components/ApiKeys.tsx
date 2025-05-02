/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

export class ApiKeys {
  public static get BingMapsKey() {
    return import.meta.env.IMJS_BING_MAPS_KEY ?? "";
  }

  public static get GoogleMapsKey() {
    return import.meta.env.IMJS_GOOGLE_MAPS_KEY ?? "";
  }


  public static get CesiumKey() {
    return import.meta.env.IMJS_CESIUM_ION_KEY ?? "";
  }
}
