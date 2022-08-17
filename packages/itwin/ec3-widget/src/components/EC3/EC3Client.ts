/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { CC_BASE_PATH } from "./generated/api";

const ACCEPT = "application/vnd.bentley.itwin-platform.v1+json";

const prefixUrl = (baseUrl?: string, prefix?: string) => {
  if (prefix && baseUrl) {
    return baseUrl.replace("api.bentley.com", `${prefix}api.bentley.com`);
  }
  return baseUrl;
};

export default class EC3Client {
  public async getEC3AccessToken(username: string, password: string) {
    if (username === undefined || password === undefined) {
      return undefined;
    }

    const url = "https://etl-api.cqd.io/api/rest-auth/login";
    const prop = {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
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
}
