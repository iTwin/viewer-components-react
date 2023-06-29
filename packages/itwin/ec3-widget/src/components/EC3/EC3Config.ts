/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { IModelApp } from "@itwin/core-frontend";
import { CARBON_CALCULATION_BASE_PATH, REPORTING_BASE_PATH } from "@itwin/insights-client";
import type { GetAccessTokenFn } from "../api/APIContext";

export const EC3URI = "https://buildingtransparency.org/";

export interface EC3ConfigCommonProps {
  /**
   * The OAuth client ID used to authenticate with the EC3 API.
   */
  clientId: string;
  iTwinId: string;

  /**
   * A callback function that returns an access token for authenticating API requests.
   * If not specified, it defaults to the authorizationClient of the {@link IModelApp}.
   */
  getAccessToken?: GetAccessTokenFn;

  /**
   * The URI of the EC3 API. If not specified, it defaults to "https://buildingtransparency.org/".
   */
  ec3Uri?: string;

  /**
   * The base path for the Reporting API endpoints. If not specified, it defaults to {@link REPORTING_BASE_PATH}.
   */
  reportingBasePath?: string;

  /**
   * The base path for the Carbon Calculation API endpoints. If not specified, it defaults to {@link CARBON_CALCULATION_BASE_PATH}.
   */
  carbonCalculationBasePath?: string;
}

export type EC3ConfigPropsWithRedirectUri = EC3ConfigCommonProps & {
  /**
   * The OAuth redirect URI used to authenticate with the EC3 API.
   */
  redirectUri: string;
};

export type EC3ConfigPropsWithGetEC3AccessToken = EC3ConfigCommonProps & {
  /**
   * A callback function that returns an access token for the EC3 API.
   */
  getEC3AccessToken: GetAccessTokenFn;
};

export type EC3ConfigProps = EC3ConfigPropsWithRedirectUri | EC3ConfigPropsWithGetEC3AccessToken;

export class EC3Config {
  public readonly clientId: string;
  public readonly scope = "read%20write";
  public readonly redirectUri?: string;
  public readonly ec3Uri?: string;
  public readonly reportingBasePath: string;
  public readonly carbonCalculationBasePath: string;
  public readonly iTwinId: string;
  public readonly getAccessToken: GetAccessTokenFn;
  public readonly getEC3AccessToken?: GetAccessTokenFn;

  constructor(props: EC3ConfigProps) {
    this.clientId = props.clientId;
    this.ec3Uri = props.ec3Uri ?? EC3URI;
    this.iTwinId = props.iTwinId;

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

    if ("redirectUri" in props) {
      this.redirectUri = props.redirectUri;
    }

    if ("getEC3AccessToken" in props) {
      this.getEC3AccessToken = props.getEC3AccessToken;
    }
  }
}
