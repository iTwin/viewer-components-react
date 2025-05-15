import type { Cartographic } from "@itwin/core-common";

/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import type { Range2d } from "@itwin/core-geometry";
import type { MapCartoRectangle } from "@itwin/core-frontend";
export interface AddressData {
  formattedAddress: string;
}

export interface AddressRequest {
    method: "POST" | "GET";
    url: URL;
    headers?: { [key: string]: string };
    body?: string;
}

export interface GeoCoder {
  getLocation(data: AddressData): Promise<Cartographic>;
}

export interface AddressProvider {
  getSuggestions(query: string, viewRect: MapCartoRectangle): Promise<AddressData[]>;
  supportsAddressLocation(): this is GeoCoder;
}
