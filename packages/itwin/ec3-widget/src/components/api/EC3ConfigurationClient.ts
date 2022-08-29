/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/*
import { IModelApp } from "@bentley/imodeljs-frontend";
import { AuthorizationClient } from "@bentley/itwin-client";
import { getConfig } from "../../config";
import { prefixUrl } from "../useApiPrefix";
import {
  BASE_PATH,
  CalculatedPropertyCreateReportingAPI,
  CalculatedPropertyUpdateReportingAPI,
  GroupCreateReportingAPI,
  GroupPropertyCreateReportingAPI,
  GroupPropertyUpdateReportingAPI,
  GroupUpdateReportingAPI,
  MappingCreateReportingAPI,
  MappingsApi,
  MappingUpdateReportingAPI,
  ReportsApi,
} from "./generated";
*/
import { IModelApp } from "@itwin/core-frontend";
import { Configuration } from "../Template";
//import * as isomorphicFetch from "isomorphic-fetch";
//import * as url from "url";
import isomorphicFetch from 'cross-fetch';

const ACCEPT = "application/vnd.bentley.itwin-platform.v1+json";

export const BASE_PATH = "https://dev-api.bentley.com/insights/carbon-calculation/ec3/configurations".replace(
  /\/+$/,
  ""
);

class EC3ConfigurationClient {
  public async getConfigurations(contextId: string) {
    if (!IModelApp.authorizationClient)
      throw new Error(
        "AuthorizationClient is not defined. Most likely IModelApp.startup was not called yet."
      );
    const _accessToken = await IModelApp.authorizationClient.getAccessToken();
    const url = "https://dev-api.bentley.com/insights/carbon-calculation/ec3/configurations?iTwinId=" + contextId;

    const prop = {
      method: "GET",
      Request: "no-cors",
      headers: {
        "Accept": ACCEPT,
        "Authorization": _accessToken,
      },
    };

    const response = await isomorphicFetch(url, prop);

    if (response.ok) {
      return await response.json();
    }
    else {
      var empty: any = {
        configurations: []
      }

      return empty;
    }
  }

  public async getConfiguration(configurationId: string) {
    if (!IModelApp.authorizationClient)
      throw new Error(
        "AuthorizationClient is not defined. Most likely IModelApp.startup was not called yet."
      );
    const _accessToken = await IModelApp.authorizationClient.getAccessToken();
    const url = "https://dev-api.bentley.com/insights/carbon-calculation/ec3/configurations/" + configurationId;
    const prop = {
      method: "GET",
      Request: "no-cors",
      headers: {
        "Accept": ACCEPT,
        "Authorization": _accessToken,
      },
    };
    const response = await isomorphicFetch(url, prop);
    return await response.json();
  }

  public async createConfiguration(configuration: Configuration) {
    if (!IModelApp.authorizationClient)
      throw new Error(
        "AuthorizationClient is not defined. Most likely IModelApp.startup was not called yet."
      );
    const _accessToken = await IModelApp.authorizationClient.getAccessToken();
    const url = "https://dev-api.bentley.com/insights/carbon-calculation/ec3/configurations/";
    const prop = {
      method: "POST",
      Request: "no-cors",
      headers: {
        "Accept": ACCEPT,
        "Authorization": _accessToken,
        "content-type": "application/json"
      },
      body: JSON.stringify(configuration)
    };
    const response = await isomorphicFetch(url, prop);
    return response;
  }

  public async updateConfiguration(
    configuration: Configuration,
  ) {
    if (!IModelApp.authorizationClient)
      throw new Error(
        "AuthorizationClient is not defined. Most likely IModelApp.startup was not called yet."
      );
    const _accessToken = await IModelApp.authorizationClient.getAccessToken();
    const url = "https://dev-api.bentley.com/insights/carbon-calculation/ec3/configurations/" + configuration.id;
    const prop = {
      method: "PUT",
      Request: "no-cors",
      headers: {
        "Accept": ACCEPT,
        "Authorization": _accessToken,
        "content-type": "application/json"
      },
      body: JSON.stringify(configuration)
    };
    const response = await isomorphicFetch(url, prop);
    return response;
  }

  public async deleteConfiguration(configurationId: string) {
    if (!IModelApp.authorizationClient)
      throw new Error(
        "AuthorizationClient is not defined. Most likely IModelApp.startup was not called yet."
      );
    const _accessToken = await IModelApp.authorizationClient.getAccessToken();
    const url = "https://dev-api.bentley.com/insights/carbon-calculation/ec3/configurations/" + configurationId;
    const prop = {
      method: "DELETE",
      Request: "no-cors",
      headers: {
        "Accept": ACCEPT,
        "Authorization": _accessToken,
      },
    };
    const response = await isomorphicFetch(url, prop);
    return response;
  }

}

export interface FetchAPI {
  (url: string, init?: any): Promise<Response>;
}

export interface FetchArgs {
  url: string;
  options: any;
}

export { EC3ConfigurationClient };
