/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
import { IModelApp } from "@itwin/core-frontend";
import { BASE_PATH, ReportsApi } from "./generated";

const ACCEPT = "application/vnd.bentley.itwin-platform.v1+json";

const prefixUrl = (baseUrl?: string, prefix?: string) => {
  if (prefix && baseUrl) {
    return baseUrl.replace("api.bentley.com", `${prefix}api.bentley.com`);
  }
  return baseUrl;
};

//To be only used within Viewer
class ReportingClient {
  private _reportsApi: ReportsApi;
  constructor() {
    const baseUrl = prefixUrl(BASE_PATH, process.env.IMJS_URL_PREFIX);
    this._reportsApi = new ReportsApi(undefined, baseUrl);
  }

  public async getReports(projectId: string) {
    const _accessToken =
      (await IModelApp.authorizationClient?.getAccessToken()) ?? "";
    return this._reportsApi.getProjectReports(
      projectId,
      _accessToken,
      undefined,
      undefined,
      false,
      ACCEPT
    );
  }
}

//Global singleton
const reportingClientApi = new ReportingClient();

export { reportingClientApi };
