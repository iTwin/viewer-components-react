/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
import { IModelApp } from "@itwin/core-frontend";
import type { IEC3ConfigurationsClient, IEC3JobsClient, IOdataClient, IReportsClient, Report } from "@itwin/insights-client";
import { CARBON_CALCULATION_BASE_PATH, EC3ConfigurationsClient, EC3JobsClient, ODataClient, REPORTING_BASE_PATH, ReportsClient } from "@itwin/insights-client";
import type { GetAccessTokenFn } from "../context/APIContext";
import type { EC3Token } from "./EC3Token";

export const EC3URI = "https://buildingtransparency.org/";

/**
 * EC3 Config Common Props
 * @beta
 */
export interface EC3ConfigCommonProps {
  /**
   * The OAuth client ID used to authenticate with the EC3 API.
   */
  clientId: string;
  iTwinId: string;

  /**
   * A callback function that returns an access token for authenticating API requests.
   * If not specified, it defaults to the authorizationClient of the IModelApp.
   */
  getAccessToken?: GetAccessTokenFn;

  /**
   * The URI of the EC3 API. If not specified, it defaults to "https://buildingtransparency.org/".
   */
  ec3Uri?: string;

  /**
   * The base path for the Reporting API endpoints. If not specified, it defaults to REPORTING_BASE_PATH from @itwin/insights-client.
   */
  reportingBasePath?: string;

  /**
   * The base path for the Carbon Calculation API endpoints. If not specified, it defaults to CARBON_CALCULATION_BASE_PATH from @itwin/insights-client.
   */
  carbonCalculationBasePath?: string;

  /**
   * A custom implementation of ReportsClient. If provided, reportingBasePath is ignored.
   */
  reportsClient?: IReportsClient;

  /**
   * A custom implementation of OdataClient. If provided, reportingBasePath is ignored.
   */
  oDataClient?: IOdataClient;

  /**
   * A custom implementation of EC3JobsClient. If provided, carbonCalculationBasePath is ignored.
   */
  ec3JobsClient?: IEC3JobsClient;

  /**
   * A custom implementation of EC3ConfigurationClient. If provided, carbonCalculationBasePath is ignored.
   */
  ec3ConfigurationsClient?: IEC3ConfigurationsClient;
}

/**
 * EC3 Config Props with Redirect URI
 * @beta
 */
export type EC3ConfigPropsWithRedirectUri = EC3ConfigCommonProps & {
  /**
   * The OAuth redirect URI used to authenticate with the EC3 API.
   */
  redirectUri: string;
};

/**
 * EC3 Config Props with EC3 Access Token
 * @beta
 */
export type EC3ConfigPropsWithGetEC3AccessToken = EC3ConfigCommonProps & {
  /**
   * A callback function that returns an access token for the EC3 API.
   */
  getEC3AccessToken: GetAccessTokenFn;
};

/**
 * EC3 Config Props with default report
 * @beta
 */
export type EC3ConfigPropsWithDefaultReport = EC3ConfigCommonProps & {
  /**
   * The default report to be used for EC3 configuration
   */
  defaultReport?: Report;
};

/**
 * EC3 Config Props
 * @beta
 */
export type EC3ConfigProps = EC3ConfigPropsWithRedirectUri | EC3ConfigPropsWithGetEC3AccessToken | EC3ConfigPropsWithDefaultReport;

export const getDefaultEC3Uri = (ec3Uri?: string) => {
  return ec3Uri ?? EC3URI;
};

export class EC3Config {
  public readonly clientId: string;
  public readonly scope = "read%20write";
  public readonly ec3Uri?: string;
  public readonly reportingBasePath: string;
  public readonly carbonCalculationBasePath: string;
  public readonly iTwinId: string;
  public readonly getAccessToken: GetAccessTokenFn;
  public readonly getEC3AccessToken: GetAccessTokenFn;
  public readonly defaultReport?: Report;
  private token?: EC3Token;
  private readonly redirectUri?: string;
  public readonly reportsClient: IReportsClient;
  public readonly oDataClient: IOdataClient;
  public readonly ec3JobsClient: IEC3JobsClient;
  public readonly ec3ConfigurationsClient: IEC3ConfigurationsClient;

  constructor(props: EC3ConfigProps) {
    this.clientId = props.clientId;
    this.ec3Uri = getDefaultEC3Uri(props.ec3Uri);
    this.iTwinId = props.iTwinId;

    this.reportingBasePath = props.reportingBasePath ? REPORTING_BASE_PATH.replace("https://api.bentley.com", props.reportingBasePath) : REPORTING_BASE_PATH;

    this.carbonCalculationBasePath = props.carbonCalculationBasePath
      ? CARBON_CALCULATION_BASE_PATH.replace("https://api.bentley.com", props.carbonCalculationBasePath)
      : CARBON_CALCULATION_BASE_PATH;

    this.getAccessToken = props.getAccessToken ?? (async () => (IModelApp.authorizationClient ? IModelApp.authorizationClient.getAccessToken() : ""));

    this.redirectUri = "redirectUri" in props ? props.redirectUri : undefined;
    this.getEC3AccessToken = "getEC3AccessToken" in props ? props.getEC3AccessToken : this.getAuthWindowToken.bind(this);
    this.defaultReport = "defaultReport" in props ? props.defaultReport : undefined;
    this.reportsClient = props.reportsClient ?? new ReportsClient(this.reportingBasePath);
    this.oDataClient = props.oDataClient ?? new ODataClient(this.reportingBasePath);
    this.ec3JobsClient = props.ec3JobsClient ?? new EC3JobsClient(this.carbonCalculationBasePath);
    this.ec3ConfigurationsClient = props.ec3ConfigurationsClient ?? new EC3ConfigurationsClient(this.carbonCalculationBasePath);
  }

  private tokenExpired(): boolean {
    const EXPIRATION_REDUCTION_BY_MS = 300000; // 5 minutes in milliseconds
    return !(this.token && this.token.exp - EXPIRATION_REDUCTION_BY_MS > Date.now());
  }

  private async getAuthWindowToken(): Promise<string> {
    return new Promise((resolve, reject) => {
      if (this.tokenExpired()) {
        let authWindow: Window | null = null;

        const receiveMessage = (event: MessageEvent<EC3Token>) => {
          if (event.data.source !== "ec3-auth") return;
          authWindow?.close();
          window.removeEventListener("message", receiveMessage, false);

          if (!event.data.token) {
            reject("Invalid token received");
            return;
          }
          this.token = event.data;
          resolve(event.data.token);
        };
        window.addEventListener("message", receiveMessage, false);

        const url = this.getAuthorizationUrl();
        authWindow = window.open(url, "_blank", "toolbar=0,location=0,menubar=0,width=800,height=700");
      } else {
        resolve(this.token!.token);
      }
    });
  }

  private getAuthorizationUrl(): string {
    return `${this.ec3Uri}oauth2/authorize?client_id=${this.clientId}&redirect_uri=${this.redirectUri}&response_type=code&scope=${this.scope}`;
  }
}
