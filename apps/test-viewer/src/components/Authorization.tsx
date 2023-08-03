/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { createContext, PropsWithChildren, useContext, useEffect, useState } from "react";
import { BrowserAuthorizationClient } from "@itwin/browser-authorization";
import { AuthorizationClient } from "@itwin/core-common";
import { AccessToken, BeEvent } from "@itwin/core-bentley";

export enum AuthorizationState {
  Pending,
  Authorized,
  Offline
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

export interface AuthorizationContext {
  client: DemoAuthClient | BrowserAuthorizationClient;
  state: AuthorizationState;
}

const authorizationContext = createContext<AuthorizationContext>({
  client: new DemoAuthClient(),
  state: AuthorizationState.Offline,
})

export function useAuthorizationContext() {
  return useContext(authorizationContext);
}

const shouldUseDemoClient = !!process.env.IMJS_DEMO_CLIENT;
const createAuthClient = (): AuthorizationContext => shouldUseDemoClient ? ({
  client: new DemoAuthClient(),
  state: AuthorizationState.Offline
}) : ({
  client: new BrowserAuthorizationClient({
    scope: process.env.IMJS_AUTH_CLIENT_SCOPES ?? "",
    clientId: process.env.IMJS_AUTH_CLIENT_CLIENT_ID ?? "",
    redirectUri: process.env.IMJS_AUTH_CLIENT_REDIRECT_URI ?? "",
    postSignoutRedirectUri: process.env.IMJS_AUTH_CLIENT_LOGOUT_URI,
    responseType: "code",
    authority: process.env.IMJS_AUTH_AUTHORITY,
  }),
  state: AuthorizationState.Pending,
});

export function AuthorizationProvider(props: PropsWithChildren<unknown>) {
  const [contextValue, setContextValue] = useState<AuthorizationContext>(() => createAuthClient());

  const authClient = contextValue.client;
  useEffect(() => {
    return authClient.onAccessTokenChanged.addListener(() => setContextValue((prev: any) => ({ ...prev, state: AuthorizationState.Authorized })));
  }, [authClient]);

  useEffect(() => {
    if (!(authClient instanceof BrowserAuthorizationClient))
      return;

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
    if (!(client instanceof BrowserAuthorizationClient))
      return;

    (async () => {
      await client.handleSigninCallback();
    })();
  }, [client]);

  return <></>
}

