/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
export class EC3Config {
  public CLIENT_ID: string;
  public SCOPE = "read%20write";
  public REDIRECT_URI: string;
  public EC3_URI: string;

  constructor(props: EC3ConfigProps) {
    this.CLIENT_ID = props.clientId;
    this.REDIRECT_URI = props.redirectUri;
    this.EC3_URI = props.ec3Uri ?? "https://buildingtransparency.org/";
  }
}

export interface EC3ConfigProps {
  clientId: string,
  redirectUri: string,
  ec3Uri?: string,
}