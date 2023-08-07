/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { createContext, PropsWithChildren, useContext, useEffect, useState } from "react";
import { BrowserAuthorizationClient, isBrowserAuthorizationClient } from "@itwin/browser-authorization";
import { AuthorizationClient } from "@itwin/core-common";
import { AccessToken, BeEvent } from "@itwin/core-bentley";
import { ViewerAuthorizationClient as WebViewerAuthorizationClient } from "@itwin/web-viewer-react";

export enum AuthorizationState {
  Pending,
  Authorized
}

class DemoAuthClient implements AuthorizationClient {
  readonly onAccessTokenChanged: BeEvent<(token: AccessToken) => void> = new BeEvent();
  private accessToken: Promise<string> | undefined = undefined;

  public async getAccessToken(): Promise<string> {
    this.accessToken ??= (async () => {
      const response = await fetch(
        "https://prod-imodeldeveloperservices-eus.azurewebsites.net/api/v0/sampleShowcaseUser/devUser",
      );
      const result = await response.json();
      setTimeout(
        () => this.accessToken = undefined,
        new Date(result._expiresAt).getTime() - new Date().getTime() - 5000,
      );
      return `Bearer ${result._jwt}`;
    })();
    return this.accessToken;
  }
}

class ViewerAuthorizationClient implements WebViewerAuthorizationClient {
  private _client: WebViewerAuthorizationClient;

  constructor(useDemoClient: boolean) {
    this._client = useDemoClient ? new DemoAuthClient() :
      new BrowserAuthorizationClient({
        scope: process.env.IMJS_AUTH_CLIENT_SCOPES ?? "",
        clientId: process.env.IMJS_AUTH_CLIENT_CLIENT_ID ?? "",
        redirectUri: process.env.IMJS_AUTH_CLIENT_REDIRECT_URI ?? "",
        postSignoutRedirectUri: process.env.IMJS_AUTH_CLIENT_LOGOUT_URI,
        responseType: "code",
        authority: process.env.IMJS_AUTH_AUTHORITY,
      });
  }

  public async getAccessToken(): Promise<string> {
    return this._client.getAccessToken();
  }

  public async signInSilent() {
    if (isBrowserAuthorizationClient(this._client)) {
      this._client.signInSilent();
    }
  }

  public async signInRedirect() {
    if (isBrowserAuthorizationClient(this._client)) {
      this._client.signInRedirect();
    }
  }

  public async handleSigninCallback() {
    if (isBrowserAuthorizationClient(this._client)) {
      this._client.handleSigninCallback();
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
  client: new ViewerAuthorizationClient(true),
  state: AuthorizationState.Authorized,
})

export function useAuthorizationContext() {
  return useContext(authorizationContext);
}

const shouldUseDemoClient = !!process.env.IMJS_DEMO_CLIENT;
const createAuthClient = (): AuthorizationContext => ({
  client: new ViewerAuthorizationClient(shouldUseDemoClient),
  state: shouldUseDemoClient ? AuthorizationState.Authorized : AuthorizationState.Pending
});

export function AuthorizationProvider(props: PropsWithChildren<unknown>) {
  const [contextValue, setContextValue] = useState<AuthorizationContext>(() => createAuthClient());

  const authClient = contextValue.client;
  useEffect(() => {
    return authClient.onAccessTokenChanged.addListener(() => setContextValue((prev: any) => ({ ...prev, state: AuthorizationState.Authorized })));
  }, [authClient]);

  useEffect(() => {
    const signIn = async () => {
      try {
        await authClient.signInSilent();
      }
      catch {
        await authClient.signInRedirect();
      }
    }

    void signIn();
  }, [authClient]);

  return <authorizationContext.Provider value={contextValue}>
    {props.children}
  </authorizationContext.Provider>
}

export function SignInRedirect() {
  const { client } = useAuthorizationContext();

  useEffect(() => {
    (async () => {
      await client.handleSigninCallback();
    })();
  }, [client]);

  return <></>
}

