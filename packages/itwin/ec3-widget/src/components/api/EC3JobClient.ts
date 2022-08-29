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



class EC3JobClient {
  public async createJob(accesToken: string, ec3BearerToken: string, configurationId: string, projectName: string) {
    const obj = { ec3BearerToken, configurationId, projectName };

    const url = " https://dev-api.bentley.com/insights/carbon-calculation/ec3/jobs";
    const prop = {
      method: "POST",
      Request: "no-cors",
      headers: {
        "content-type": "application/json",
        "Accept": ACCEPT,
        "Authorization": accesToken,
      },
      body: JSON.stringify(obj)
    };
    const response = await isomorphicFetch(url, prop);
    return await response.json();
  }

  public async getEC3JobStatus(token: string, jobId: string) {
    const url = " https://dev-api.bentley.com/insights/carbon-calculation/ec3/jobs/" + jobId;
    const prop = {
      method: "GET",
      Request: "no-cors",
      headers: {
        "Accept": ACCEPT,
        "Authorization": token,
      },
    };
    const response = await isomorphicFetch(url, prop);
    return await response.json();
  }

}

export interface FetchAPI {
  (url: string, init?: any): Promise<Response>;
}

export interface FetchArgs {
  url: string;
  options: any;
}


export { EC3JobClient };
