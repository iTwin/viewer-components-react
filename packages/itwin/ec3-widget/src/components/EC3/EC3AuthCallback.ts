/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { EC3Config, EC3ConfigProps } from "./EC3Config";
import { EC3TokenCache } from "./EC3TokenCache";

export class EC3AuthCallback {
  /* This function must be called in path set in process.env.EC3_AUTH_CLIENT_REDIRECT_URI.
  *
  * Example:
  * } else if (window.location.pathname === "/callback") {
  *   EC3AuthCallback.handle();
  * } else {
  *
  * Here /callback is the relative path of the redirect URI
  */
  public static handle(props: EC3ConfigProps) {
    const MILI_SECONDS = 1000;
    const EXPIRATRION_REDUCTION = 15 * 60;

    async function exchangeToken() {
      const config = new EC3Config(props);
      const code = new URL(window.location.href).searchParams.get("code");
      const prop = {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: `client_id=${config.CLIENT_ID}&grant_type=authorization_code&code=${code}`,
      };

      const response = await fetch(`${config.EC3_URI}api/oauth2/token`, prop);
      const tokenResponse = await response.json();
      const token: EC3TokenCache = {
        token: tokenResponse.access_token,
        exp: Date.now() + (tokenResponse.expires_in - EXPIRATRION_REDUCTION) * MILI_SECONDS,
      };

      const parentWindow = window.opener as Window;
      parentWindow.postMessage(token, window.location.origin);
    }

    exchangeToken();
  }
}
