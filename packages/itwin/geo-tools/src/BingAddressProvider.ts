
/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { Cartographic } from "@itwin/core-common";
import { IModelApp } from "@itwin/core-frontend";

import type { MapCartoRectangle } from "@itwin/core-frontend";
import type { GeoCoder, AddressProvider, AddressRequest, AddressData } from "./AddressProvider";

export class BingAddressProvider implements AddressProvider {
  private _radius = 5000;
  private _maxResults = 10;
  private _entityTypes = ["Address,Place"];
  private _bingKey: string;
  public readonly hasAddressIds = false;

  public supportsAddressLocation(): this is GeoCoder  {
      return false;
    }

  constructor(radius?: number, maxResults?: number, entityTypes?: string[]) {
    if (radius !== undefined) {
      this._radius = radius;
    }

    if (maxResults !== undefined) {
      this._maxResults = maxResults;
    }

    if (entityTypes && entityTypes.length > 0) {
      this._entityTypes = entityTypes;
    }

    this._bingKey = "";
    if (IModelApp.mapLayerFormatRegistry?.configOptions?.BingMaps) {
      this._bingKey = IModelApp.mapLayerFormatRegistry.configOptions.BingMaps.value;
    }
  }

  // Sample request: http://dev.virtualearth.net/REST/v1/Autosuggest?query=<user_prefix>&userLocation=<lat,long,confidence_radius>&userCircularMapView=<lat,long,radius>&userMapView=<nw_lat,nw_long,se_lat,se_long>&maxResults=<max_results>&includeEntityTypes=<Place,Address,Business>&culture=<culture_code>&userRegion=<country_code>&countryFilter=<country_code_or_none>&key=<BingMapKey>
  private getSuggestionsRequest(query: string, viewRect: MapCartoRectangle): AddressRequest {
    const entityTypesStr = this._entityTypes.join();
    const northWest = Cartographic.fromRadians({longitude: viewRect.west, latitude: viewRect.north});
    const southEast = Cartographic.fromRadians({longitude: viewRect.east, latitude: viewRect.south});
    const userMapView = [northWest.latitudeDegrees, northWest.longitudeDegrees, southEast.latitudeDegrees, southEast.longitudeDegrees];
    return {
      method: "GET",
      url: new URL(`https://dev.virtualearth.net/REST/v1/Autosuggest?query=${query}&userMapView=${userMapView}&maxResults=${this._maxResults}&includeEntityTypes=${entityTypesStr}&key=${this._bingKey}`),
    }
  }

  /**
   * longitude(X) are expressed in any range between -2PI to +2PI
   * Latitudes(Y) values are kept between -PI and +PI while
   */
  public async getSuggestions(query: string, viewRect: MapCartoRectangle): Promise<AddressData[]> {
    const request = this.getSuggestionsRequest(query, viewRect);

    try {
      const response = await fetch(request.url, {method: "GET"});
      const json: any = await response.json();
      // Response format documented here:
      // https://docs.microsoft.com/en-us/bingmaps/rest-services/autosuggest#response-format
      const value = json.resourceSets[0].resources[0].value;

      const addresses: AddressData[] = [];
      if (Array.isArray(value)) {
        value.forEach((address) => {
          addresses.push({ formattedAddress: address.address.formattedAddress });
        });
      }
      return addresses;
    } catch (error) {
      return [];
    }
  }
}
