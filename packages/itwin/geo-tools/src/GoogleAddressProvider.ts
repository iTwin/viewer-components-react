/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { Cartographic } from "@itwin/core-common";
import { IModelApp } from "@itwin/core-frontend";

import type { MapCartoRectangle } from "@itwin/core-frontend";
import type { AddressProvider, AddressRequest, AddressData, GeoCoder } from "./AddressProvider";

// export class GoogleLegacyAddressProvider implements AddressProvider {
//   private _radius = 5000;
//   private _maxResults = 10;

//   private _apiKey: string;
//   public readonly hasAddressIds = true;

//   constructor(radius?: number, maxResults?: number, _entityTypes?: string[]) {
//     if (radius !== undefined) {
//       this._radius = radius;
//     }

//     if (maxResults !== undefined) {
//       this._maxResults = maxResults;
//     }

//     // if (entityTypes && entityTypes.length > 0) {
//     //   this._entityTypes = entityTypes;
//     // }

//     this._apiKey = "";
//     if (IModelApp.mapLayerFormatRegistry?.configOptions?.GoogleMaps) {
//       this._apiKey = IModelApp.mapLayerFormatRegistry?.configOptions?.GoogleMaps.value;
//     }
//   }

//   public supportsAddressLocation(): this is AddressLocator  {
//     return true;
//   }

//   public async getLocation(data: GoogleAddressData): Promise<Cartographic> {
//     // https://places.googleapis.com/v1/places/PLACE_ID

//     const url = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${data.placeId}&fields=geometry&key=${this._apiKey}`;
//     const response = await fetch(url, {method: "GET"});
//     const json: any = await response.json();

//     console.log("getLocation: ", json.result.geometry.location);
//     const lat = json?.result?.geometry?.location?.lat;
//     const long = json?.result?.geometry?.location?.lng;
//     if (lat === undefined || long === undefined) {
//       throw new Error("Invalid location data");
//     }
//     return Cartographic.fromDegrees({longitude: long, latitude: lat});
//   }


//   private getUrl(query: string, _userView: Range2d): string {
//     const input = encodeURIComponent(query);
//     return `https://maps.googleapis.com/maps/api/place/autocomplete/json?input=${input}&key=${this._apiKey}`;
//   }

//   /**
//    * longitude(X) are expressed in any range between -2PI to +2PI
//    * Latitudes(Y) values are kept between -PI and +PI while
//    */
//   public async getAddresses(query: string, viewLatLongBBox: Range2d): Promise<AddressData[]> {
//     const url = this.getUrl(query, viewLatLongBBox);

//     if (query.length < 3) {
//       return [];
//     }

//     try {
//       const response = await fetch(url, {method: "GET"});
//       const json: any = await response.json();
//       // Response format documented here:
//       // https://developers.google.com/maps/documentation/places/web-service/legacy/autocomplete

//       const addresses: GoogleAddressData[] = [];
//       if (Array.isArray(json.predictions)) {
//         json.predictions.forEach((prediction:any) => {
//           addresses.push({  formattedAddress: prediction.description, placeId: prediction.place_id });
//         });
//       }
//       return addresses;
//     } catch (error) {
//       return [];
//     }
//   }
// }


export interface GoogleAddressData  extends AddressData {
  placeId: string;
}

export class GoogleAddressProvider implements AddressProvider {
  private _radius = 5000;
  private _apiKey: string;
  public readonly hasAddressIds = true;

  constructor(locationBiasRadius?: number) {
    if (locationBiasRadius !== undefined) {
      this._radius = locationBiasRadius;
    }

    this._apiKey = "";
    if (IModelApp.mapLayerFormatRegistry?.configOptions?.GoogleMaps) {
      this._apiKey = IModelApp.mapLayerFormatRegistry?.configOptions?.GoogleMaps.value;
    }
  }

  public supportsAddressLocation(): this is GeoCoder  {
    return true;
  }

  public async getLocation(data: GoogleAddressData): Promise<Cartographic> {

    const response = await fetch(`https://places.googleapis.com/v1/places/${data.placeId}`, {
      method: "GET",
      headers: {
        "X-Goog-Api-Key": this._apiKey,
        "X-Goog-FieldMask": "location",
      } });
    const json: any = await response.json();

    const lat = json?.location?.geometry?.latitude
    const long = json?.location?.geometry?.longitude
    if (lat === undefined || long === undefined) {
      throw new Error("Invalid location data");
    }
    return Cartographic.fromDegrees({longitude: long, latitude: lat});
  }

  protected getSuggestionsRequest(query: string, viewRect: MapCartoRectangle): AddressRequest {
    const url = new URL("https://places.googleapis.com/v1/places:autocomplete");

    const body = {
      input: query,
      locationBias: {
        circle: {
          center: {
            latitude: viewRect.cartoCenter.latitudeDegrees,
            longitude: viewRect.cartoCenter.longitudeDegrees,
          },
          radius: this._radius,
        },
      }
    }
    return {
      url: url,
      method: "POST",
      headers: {
        "X-Goog-Api-Key": this._apiKey,
        "X-Goog-FieldMask": "suggestions.placePrediction.text.text,suggestions.placePrediction.placeId",
      },
      body: JSON.stringify(body),
    }
  }

  public async getSuggestions(query: string, userView: MapCartoRectangle): Promise<AddressData[]> {
    const request = this.getSuggestionsRequest(query, userView);

    if (query.length < 3) {
      return [];
    }

    try {
      const response = await fetch(request.url, {
        method: request.method,
        headers: request.headers,
        body: request.body,
        });

      const json: any = await response.json();

      // Response format documented here:
      // https://developers.google.com/maps/documentation/places/web-service/place-autocomplete
      const addresses: GoogleAddressData[] = [];
      if (Array.isArray(json.suggestions)) {
        json.suggestions.forEach((suggestion:any) => {
          addresses.push({
            formattedAddress: suggestion?.placePrediction?.text?.text,
            placeId: suggestion?.placePrediction?.placeId });
        });
      }
      return addresses;
    } catch (error) {
      return [];
    }
  }
}
