/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import type { EC3ConfigProps } from "./EC3Config";
import { EC3Config } from "./EC3Config";
import type { EC3Token } from "./EC3Token";

export class EC3AuthCallback {
  /* This function must be called in EC3 authentication redirect path.
  *
  * Example:
  * } else if (window.location.pathname === "/callback") {
  *   EC3AuthCallback.handle({
  *     clientId: "...",
  *     redirectUri: "http://localhost:8887/callback",
  *   });
  * } else {
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
        body: `client_id=${config.clientId}&grant_type=authorization_code&code=${code}`,
      };

      const response = await fetch(`${config.ec3Uri}api/oauth2/token`, prop);
      const tokenResponse = await response.json();
      const token: EC3Token = {
        token: tokenResponse.access_token,
        exp: Date.now() + (tokenResponse.expires_in - EXPIRATRION_REDUCTION) * MILI_SECONDS,
        source: "ec3-auth",
      };

      const parentWindow = window.opener as Window;
      parentWindow.postMessage(token, window.location.origin);
    }

    void exchangeToken();
  }
}
