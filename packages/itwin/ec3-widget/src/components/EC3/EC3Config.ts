/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { IModelApp } from "@itwin/core-frontend";
import { CARBON_CALCULATION_BASE_PATH, REPORTING_BASE_PATH } from "@itwin/insights-client";
import type { GetAccessTokenFn } from "../api/context/ApiConfigContext";

export class EC3Config {
  public readonly clientId: string;
  public readonly scope = "read%20write";
  public readonly redirectUri: string;
  public readonly ec3Uri: string;
  public readonly reportingBasePath: string;
  public readonly carbonCalculationBasePath: string;
  public readonly getAccessToken: GetAccessTokenFn;

  constructor(props: EC3ConfigProps) {
    this.clientId = props.clientId;
    this.redirectUri = props.redirectUri;
    this.ec3Uri = props.ec3Uri ?? "https://buildingtransparency.org/";

    this.reportingBasePath = (props.reportingBasePath)
      ? REPORTING_BASE_PATH.replace("https://api.bentley.com", props.reportingBasePath)
      : REPORTING_BASE_PATH;

    this.carbonCalculationBasePath = (props.carbonCalculationBasePath)
      ? CARBON_CALCULATION_BASE_PATH.replace("https://api.bentley.com", props.carbonCalculationBasePath)
      : CARBON_CALCULATION_BASE_PATH;

    this.getAccessToken = props.getAccessToken ?? (async () =>
      (IModelApp.authorizationClient)
        ? IModelApp.authorizationClient.getAccessToken()
        : ""
    );
  }
}

export interface EC3ConfigProps {
  clientId: string;
  redirectUri: string;
  ec3Uri?: string;
  reportingBasePath?: string;
  carbonCalculationBasePath?: string;
  getAccessToken?: GetAccessTokenFn;
}
