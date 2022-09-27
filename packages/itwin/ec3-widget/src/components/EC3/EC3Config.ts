/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
export class EC3Config {
  public static CLIENT_ID = process.env.EC3_AUTH_CLIENT_CLIENT_ID;
  public static SCOPE = "read%20write";
  public static REDIRECT_URI = process.env.EC3_AUTH_CLIENT_REDIRECT_URI;
  public static EC3_URI = process.env.EC3_URI ?? "https://buildingtransparency.org/";
}