/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { Cartographic } from "@itwin/core-common";
import { IModelApp } from "@itwin/core-frontend";

import type { MapCartoRectangle } from "@itwin/core-frontend";
import type { AddressProvider, AddressRequest, AddressData, GeoCoder } from "./AddressProvider";

/**
 * Information requiered to retreive location from Google Places API.
 **/
export interface GoogleAddressData  extends AddressData {
  placeId: string;
}

/**
 * Address provider for Google Places API.
 * It supports address suggestions and location retrieval based on place IDs.
 */
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

  protected async getAuthRequestHeader(): Promise<Record<string, string>> {
    return { "X-Goog-Api-Key": this._apiKey};
  }

  protected async getPlacesBaseUrl(): Promise<string> {
    return "https://places.googleapis.com/v1/places/";
  }

  public async getLocation(data: GoogleAddressData): Promise<Cartographic> {
    let baseUrl = await this.getPlacesBaseUrl();
    const url = `${baseUrl}${!baseUrl.endsWith("/")?"/":""}${data.placeId}`;
    const authHeader = await this.getAuthRequestHeader();
    const response = await fetch(url, {
      method: "GET",
      headers: {
        ...authHeader,
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

  protected async getPlacesAutoCompleteUrl(): Promise<string> {
    return "https://places.googleapis.com/v1/places:autocomplete";
  }

  protected async getSuggestionsRequest(query: string, viewRect: MapCartoRectangle): Promise<AddressRequest> {
    const urlStr = await this.getPlacesAutoCompleteUrl()
    const url = new URL(urlStr);

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
    const authHeader = await this.getAuthRequestHeader();
    return {
      url: url,
      method: "POST",
      headers: {
        ...authHeader,
        "X-Goog-FieldMask": "suggestions.placePrediction.text.text,suggestions.placePrediction.placeId",
      },
      body: JSON.stringify(body),
    }
  }

  public async getSuggestions(query: string, userView: MapCartoRectangle): Promise<AddressData[]> {
    const request = await this.getSuggestionsRequest(query, userView);

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
