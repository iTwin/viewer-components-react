/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { Angle, Range2d } from "@itwin/core-geometry";
import { IModelApp } from "@itwin/core-frontend";

export interface AddressData {
  addressLine: string;
  formattedAddress: string;
}

export interface AddressProvider {
  getAddresses(query: string, viewLatLongBBox: Range2d): Promise<AddressData[]>;
}

export class BingAddressProvider implements AddressProvider {
  private _radius = 5000;
  private _maxResults = 10;
  private _entityTypes = ["Address,Place"];
  private _bingKey: string;

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
  private getUrl(query: string, userView: Range2d): string {
    const entityTypesStr = this._entityTypes.join();

    const array = userView.corners3d();
    const degreeRange: Range2d = new Range2d();
    array.forEach((point) => {
      degreeRange.extendXY(Angle.radiansToDegrees(point.x), Angle.radiansToDegrees(point.y));
    });

    const degrees = [degreeRange.low.y, degreeRange.low.x, degreeRange.high.y, degreeRange.high.x];

    return `https://dev.virtualearth.net/REST/v1/Autosuggest?query=${query}&userMapView=${degrees}&maxResults=${this._maxResults}&includeEntityTypes=${entityTypesStr}&key=${this._bingKey}`;
  }

  /**
   * longitude(X) are expressed in any range between -2PI to +2PI
   * Latitudes(Y) values are kept between -PI and +PI while
   */
  public async getAddresses(query: string, viewLatLongBBox: Range2d): Promise<AddressData[]> {
    const url = this.getUrl(query, viewLatLongBBox);

    try {
      const response = await fetch(url, {method: "GET"});
      const json: any = await response.json();
      const value = json.resourceSets[0].resources[0].value;

      const addresses: AddressData[] = [];
      if (Array.isArray(value)) {
        value.forEach((address) => {
          addresses.push({ addressLine: address.address.addressLine, formattedAddress: address.address.formattedAddress });
        });
      }
      return addresses;
    } catch (error) {
      return [];
    }
  }
}
