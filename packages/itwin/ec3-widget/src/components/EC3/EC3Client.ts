/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import type { AccessToken } from "@itwin/core-bentley";
import { CC_BASE_PATH, OneClickLCAApi } from "./generated/api";
import type { JobCreate } from "./generated/api";

const ACCEPT = "application/vnd.bentley.itwin-platform.v1+json";

const prefixUrl = (baseUrl?: string, prefix?: string) => {
  if (prefix && baseUrl) {
    return baseUrl.replace("api.bentley.com", `${prefix}api.bentley.com`);
  }
  return baseUrl;
};

export default class EC3Client {
  private _oclcaApi: OneClickLCAApi;
  constructor() {
    const baseUrl = prefixUrl(CC_BASE_PATH, process.env.IMJS_URL_PREFIX);
    this._oclcaApi = new OneClickLCAApi(undefined, baseUrl); // TODO: change to baseUrl in deployment
  }

  public async getEC3AccessToken(username: string, password: string) {
    if (username === undefined || password === undefined) {
      return undefined;
    }

    //const mode: RequestMode = "no-cors";
    //const headers: Headers = new Headers();
    //headers.append("content-type", "application/json");
    //headers.set("content-type", "application/json");

    //const url = "https://oneclicklcaapp.com/app/api/login";
    //const url = "https://api-ui.cqd.io/api/rest-auth/login";
    const url = "https://etl-api.cqd.io/api/rest-auth/login";
    //const url = "https://buildingtransparency.org/api/rest-auth/login";
    const prop = {
      method: "POST",
      //mode: mode,
      //headers: headers,
      headers: {
        "Content-Type": "application/json",
        //"Host": "etl-api.cqd.io",
        //"Accept:": "*/*"
        //"Refferer-Policy": "Access-Control-Allow-Origin",
        //"Access-Control-Request-Headers": "content-type,refferer-policy"
        //"Access-Control-Allow-Origin": "http://localhost:3000"

        //"accept": "application/json",
        //"client-id": "jK5a2SzhQP1ts00ctNHJUh2XDDSRPsamu9VHVqsg"

      },
      body: JSON.stringify({
        username,
        password,
      }),
    };

    const response = await fetch(url, prop);
    if (response.ok) {
      return response.json();
    } else {
      return undefined;
    }



  }

  public async createEC3Job(
    accessToken: AccessToken,
    job: JobCreate
  ) {
    return this._oclcaApi.createOneclicklcaJob(accessToken, job, ACCEPT);
  }

  public async getEC3JobStatus(
    accessToken: AccessToken,
    jobId: string
  ) {
    return this._oclcaApi.getOneclicklcaJobStatus(jobId, accessToken, ACCEPT);
  }
}
