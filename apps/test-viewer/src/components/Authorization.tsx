/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { createContext, PropsWithChildren, useContext, useEffect, useState } from "react";
import { BrowserAuthorizationClient, isBrowserAuthorizationClient } from "@itwin/browser-authorization";
import { AccessToken, BeEvent } from "@itwin/core-bentley";
import { ViewerAuthorizationClient as WebViewerAuthorizationClient } from "@itwin/web-viewer-react";

export enum AuthorizationState {
  Pending,
  Authorized,
}

class AccessTokenAuthClient implements WebViewerAuthorizationClient {
  readonly onAccessTokenChanged: BeEvent<(token: AccessToken) => void> = new BeEvent();

  public constructor(private _accessToken: string) {}

  public async getAccessToken(): Promise<string> {
    return this._accessToken;
  }
}

class ViewerAuthorizationClient implements WebViewerAuthorizationClient {
  private _client: WebViewerAuthorizationClient;

  constructor() {
    const userAccessToken = import.meta.env.IMJS_USER_ACCESS_TOKEN;
    this._client = userAccessToken
      ? new AccessTokenAuthClient(userAccessToken)
      : new BrowserAuthorizationClient({
          scope: import.meta.env.IMJS_AUTH_CLIENT_SCOPES ?? "",
          clientId: import.meta.env.IMJS_AUTH_CLIENT_CLIENT_ID ?? "",
          redirectUri: import.meta.env.IMJS_AUTH_CLIENT_REDIRECT_URI ?? "",
          postSignoutRedirectUri: import.meta.env.IMJS_AUTH_CLIENT_LOGOUT_URI,
          responseType: "code",
          authority: import.meta.env.IMJS_AUTH_AUTHORITY,
        });
  }

  public get isTokenClient() {
    return this._client instanceof AccessTokenAuthClient;
  }

  public async getAccessToken(): Promise<string> {
    return this._client.getAccessToken();
  }

  public async signInSilent() {
    if (isBrowserAuthorizationClient(this._client)) {
      await this._client.signInSilent();
    }
  }

  public async signInRedirect() {
    if (isBrowserAuthorizationClient(this._client)) {
      await this._client.signInRedirect();
    }
  }

  public async handleSigninCallback() {
    if (isBrowserAuthorizationClient(this._client)) {
      await this._client.handleSigninCallback();
    }
  }

  public get onAccessTokenChanged(): BeEvent<(token: AccessToken) => void> {
    return this._client.onAccessTokenChanged;
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
    (async () => {
      await client.handleSigninCallback();
    })();
  }, [client]);

  return <></>;
}
