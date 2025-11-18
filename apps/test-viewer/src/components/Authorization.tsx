/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { createContext, useContext, useEffect, useState } from "react";
import { BrowserAuthorizationClient, isBrowserAuthorizationClient } from "@itwin/browser-authorization";
import { BeEvent } from "@itwin/core-bentley";

import type { PropsWithChildren } from "react";
import type { AccessToken } from "@itwin/core-bentley";
import type { ViewerAuthorizationClient as WebViewerAuthorizationClient } from "@itwin/web-viewer-react";

export enum AuthorizationState {
  Pending,
  Authorized,
}

class AccessTokenAuthClient implements WebViewerAuthorizationClient {
  public readonly onAccessTokenChanged: BeEvent<(token: AccessToken) => void> = new BeEvent();
  #accessToken: string;

  public constructor(accessToken: string) {
    this.#accessToken = accessToken;
  }

  public async getAccessToken(): Promise<string> {
    return this.#accessToken;
  }
}

class ViewerAuthorizationClient implements WebViewerAuthorizationClient {
  #client: WebViewerAuthorizationClient | undefined;
  public readonly onAccessTokenChanged = new BeEvent<(token: AccessToken) => void>();

  private getClient(): WebViewerAuthorizationClient {
    if (!this.#client) {
      const cookies = document.cookie.split(";").map((c) => c.trim());
      const userAccessToken = cookies.find((c) => c.startsWith("IMJS_USER_ACCESS_TOKEN="))?.split("=")[1];
      this.#client = userAccessToken
        ? new AccessTokenAuthClient(userAccessToken)
        : new BrowserAuthorizationClient({
            scope: import.meta.env.IMJS_AUTH_CLIENT_SCOPES ?? "",
            clientId: import.meta.env.IMJS_AUTH_CLIENT_CLIENT_ID ?? "",
            redirectUri: import.meta.env.IMJS_AUTH_CLIENT_REDIRECT_URI ?? "",
            postSignoutRedirectUri: import.meta.env.IMJS_AUTH_CLIENT_LOGOUT_URI,
            responseType: "code",
            authority: import.meta.env.IMJS_AUTH_AUTHORITY,
          });
      this.#client.onAccessTokenChanged.addListener((token) => this.onAccessTokenChanged.raiseEvent(token));
    }
    return this.#client;
  }

  public get isTokenClient() {
    return this.getClient() instanceof AccessTokenAuthClient;
  }

  public async getAccessToken(): Promise<string> {
    return this.getClient().getAccessToken();
  }

  public async signInSilent() {
    const client = this.getClient();
    if (isBrowserAuthorizationClient(client)) {
      await client.signInSilent();
    }
  }

  public async signInRedirect() {
    const client = this.getClient();
    if (isBrowserAuthorizationClient(client)) {
      await client.signInRedirect();
    }
  }

  public async handleSigninCallback() {
    const client = this.getClient();
    if (isBrowserAuthorizationClient(client)) {
      await client.handleSigninCallback();
    }
  }
}

export interface AuthorizationContext {
  client: ViewerAuthorizationClient;
  state: AuthorizationState;
}

const authorizationContext = createContext<AuthorizationContext>({
  client: new ViewerAuthorizationClient(),
  state: AuthorizationState.Pending,
});

export function useAuthorizationContext() {
  return useContext(authorizationContext);
}

const createAuthClient = (): AuthorizationContext => {
  const client = new ViewerAuthorizationClient();
  return {
    client,
    state: client.isTokenClient ? AuthorizationState.Authorized : AuthorizationState.Pending,
  };
};

export function AuthorizationProvider(props: PropsWithChildren<unknown>) {
  const [contextValue, setContextValue] = useState<AuthorizationContext>(() => createAuthClient());

  const authClient = contextValue.client;
  useEffect(() => {
    return authClient.onAccessTokenChanged.addListener(() => setContextValue((prev) => ({ ...prev, state: AuthorizationState.Authorized })));
  }, [authClient]);

  useEffect(() => {
    const signIn = async () => {
      try {
        await authClient.signInSilent();
      } catch {
        await authClient.signInRedirect();
      }
    };

    void signIn();
  }, [authClient]);

  return <authorizationContext.Provider value={contextValue}>{props.children}</authorizationContext.Provider>;
}

export function SignInRedirect() {
  const { client } = useAuthorizationContext();

  useEffect(() => {
    void client.handleSigninCallback();
  }, [client]);

  return <></>;
}
