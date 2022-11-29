import type { GetAccessTokenFn } from "../api/context/ApiConfigContext";

/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
export class EC3Config {
  public readonly clientId: string;
  public readonly scope = "read%20write";
  public readonly redirectUri: string;
  public readonly ec3Uri: string;
  public readonly prefix: "dev" | "qa" | undefined;
  public readonly getAccessToken?: GetAccessTokenFn;

  constructor(props: EC3ConfigProps) {
    this.clientId = props.clientId;
    this.redirectUri = props.redirectUri;
    this.ec3Uri = props.ec3Uri ?? "https://buildingtransparency.org/";
    this.prefix = props.prefix;
    this.getAccessToken = props.getAccessToken;
  }
}

export interface EC3ConfigProps {
  clientId: string;
  redirectUri: string;
  ec3Uri?: string;
  prefix?: "dev" | "qa" | undefined;
  getAccessToken?: GetAccessTokenFn;
}
