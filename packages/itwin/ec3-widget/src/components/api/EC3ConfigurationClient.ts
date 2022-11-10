/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { IModelApp } from "@itwin/core-frontend";
import type { Configuration } from "../Template";
import isomorphicFetch from "cross-fetch";

const ACCEPT = "application/vnd.bentley.itwin-platform.v1+json";

export const BASE_PATH = "https://api.bentley.com/insights/carbon-calculation/ec3/configurations".replace(
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
    const url = `https://api.bentley.com/insights/carbon-calculation/ec3/configurations?iTwinId=${contextId}`;

    const prop = {
      method: "GET",
      Request: "no-cors",
      headers: {
        Accept: ACCEPT,
        Authorization: _accessToken,
      },
    };

    const response = await isomorphicFetch(url, prop);

    if (response.ok) {
      return response.json();
    } else {
      const empty: any = {
        configurations: [],
      };

      return empty;
    }
  }

  public async getConfiguration(configurationId: string) {
    if (!IModelApp.authorizationClient)
      throw new Error(
        "AuthorizationClient is not defined. Most likely IModelApp.startup was not called yet."
      );
    const _accessToken = await IModelApp.authorizationClient.getAccessToken();
    const url = `https://api.bentley.com/insights/carbon-calculation/ec3/configurations/${configurationId}`;
    const prop = {
      method: "GET",
      Request: "no-cors",
      headers: {
        Accept: ACCEPT,
        Authorization: _accessToken,
      },
    };
    const response = await isomorphicFetch(url, prop);
    return response.json();
  }

  public async createConfiguration(configuration: Configuration) {
    if (!IModelApp.authorizationClient)
      throw new Error(
        "AuthorizationClient is not defined. Most likely IModelApp.startup was not called yet."
      );
    const _accessToken = await IModelApp.authorizationClient.getAccessToken();
    const url = "https://api.bentley.com/insights/carbon-calculation/ec3/configurations/";
    const prop = {
      method: "POST",
      Request: "no-cors",
      headers: {
        "Accept": ACCEPT,
        "Authorization": _accessToken,
        "content-type": "application/json",
      },
      body: JSON.stringify(configuration),
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
    const url = `https://api.bentley.com/insights/carbon-calculation/ec3/configurations/${configuration.id}`;
    const prop = {
      method: "PUT",
      Request: "no-cors",
      headers: {
        "Accept": ACCEPT,
        "Authorization": _accessToken,
        "content-type": "application/json",
      },
      body: JSON.stringify(configuration),
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
    const url = `https://api.bentley.com/insights/carbon-calculation/ec3/configurations/${configurationId}`;
    const prop = {
      method: "DELETE",
      Request: "no-cors",
      headers: {
        Accept: ACCEPT,
        Authorization: _accessToken,
      },
    };
    const response = await isomorphicFetch(url, prop);
    return response;
  }

}

export type FetchAPI = (url: string, init?: any) => Promise<Response>;

export interface FetchArgs {
  url: string;
  options: any;
}

export { EC3ConfigurationClient };
