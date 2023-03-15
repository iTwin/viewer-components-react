/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { IModelApp } from "@itwin/core-frontend";
import { CARBON_CALCULATION_BASE_PATH, REPORTING_BASE_PATH } from "@itwin/insights-client";
import type { GetAccessTokenFn } from "../api/APIContext";

/**
 * Configuration properties for the EC3Config class.
 */
export interface EC3ConfigProps {
  /**
   * The OAuth client ID used to authenticate with the EC3 API.
   */
  clientId: string;

  /**
   * The OAuth redirect URI used to authenticate with the EC3 API.
   */
  redirectUri: string;

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

  /**
   * A callback function that returns an access token for authenticating API requests.
   * If not specified, it defaults to the authorizationClient of the {@link IModelApp}.
   */
  getAccessToken?: GetAccessTokenFn;
}

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
