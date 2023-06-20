/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import type { EC3ConfigPropsWithRedirectUri } from "./EC3Config";
import type { EC3Token } from "./EC3Token";

/* This function must be called in EC3 authentication redirect path.
*
* Example:
* } else if (window.location.pathname === "/callback") {
*   handleEC3AuthCallback({
*     clientId: "...",
*     redirectUri: "...",
*   });
* } else {
*/

export type EC3AuthCallbackConfigProps = {
  clientId: EC3ConfigPropsWithRedirectUri['clientId'];
  redirectUri: EC3ConfigPropsWithRedirectUri['redirectUri'];
  ec3Uri?: EC3ConfigPropsWithRedirectUri['ec3Uri'];
}

export function handleEC3AuthCallback(ec3Config: EC3AuthCallbackConfigProps, source: string = "ec3-auth") {
  const MILLI_SECONDS = 1000;
  const EXPIRATION_REDUCTION = 15 * 60;
  const ec3Uri = ec3Config.ec3Uri ?? "https://buildingtransparency.org/";

  async function exchangeToken() {
    const code = new URL(window.location.href).searchParams.get("code");
    const prop = {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: `client_id=${ec3Config.clientId}&grant_type=authorization_code&code=${code}&redirect_uri=${ec3Config.redirectUri}`,
    };

    const response = await fetch(`${ec3Uri}api/oauth2/token`, prop);
    const tokenResponse = await response.json();
    const token: EC3Token = {
      token: tokenResponse.access_token,
      exp: Date.now() + (tokenResponse.expires_in - EXPIRATION_REDUCTION) * MILLI_SECONDS,
      source,
    };


    const parentWindow = window.opener as Window;
    parentWindow.postMessage(token, window.location.origin);
  }

  void exchangeToken();
}
