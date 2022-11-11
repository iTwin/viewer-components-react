/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import isomorphicFetch from "cross-fetch";
import { BASE_PATH } from "./EC3ConfigurationClient";

const ACCEPT = "application/vnd.bentley.itwin-platform.v1+json";

class EC3JobClient {
  private basePath: string;

  constructor(basePath?: string) {
    this.basePath = basePath ?? BASE_PATH;
  }

  public async createJob(accesToken: string, ec3BearerToken: string, configurationId: string, projectName: string) {
    const obj = { ec3BearerToken, configurationId, projectName };

    const url = `${this.basePath}/jobs`;
    const prop = {
      method: "POST",
      Request: "no-cors",
      headers: {
        "content-type": "application/json",
        "Accept": ACCEPT,
        "Authorization": accesToken,
      },
      body: JSON.stringify(obj),
    };
    const response = await isomorphicFetch(url, prop);
    return response.json();
  }

  public async getEC3JobStatus(token: string, jobId: string) {
    const url = `${this.basePath}/jobs/${jobId}`;
    const prop = {
      method: "GET",
      Request: "no-cors",
      headers: {
        Accept: ACCEPT,
        Authorization: token,
      },
    };
    const response = await isomorphicFetch(url, prop);
    return response.json();
  }

}

export type FetchAPI = (url: string, init?: any) => Promise<Response>;

export interface FetchArgs {
  url: string;
  options: any;
}

export { EC3JobClient };
