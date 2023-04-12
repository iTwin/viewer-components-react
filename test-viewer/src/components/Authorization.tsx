/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { createContext, PropsWithChildren, useContext, useEffect, useState } from "react";
import { BrowserAuthorizationClient } from "@itwin/browser-authorization";

export enum AuthorizationState {
  Pending,
  Authorized,
}

export interface AuthorizationContext {
  client: BrowserAuthorizationClient;
  state: AuthorizationState;
}

const authorizationContext = createContext<AuthorizationContext>({
  client: new BrowserAuthorizationClient({ clientId: "", redirectUri: "", scope: "" }),
  state: AuthorizationState.Pending,
})

export function useAuthorizationContext() {
  return useContext(authorizationContext);
}

export function AuthorizationProvider(props: PropsWithChildren<unknown>) {
  const [contextValue, setContextValue] = useState<AuthorizationContext>(() => ({
    client: new BrowserAuthorizationClient({
      scope: process.env.IMJS_AUTH_CLIENT_SCOPES ?? "",
      clientId: process.env.IMJS_AUTH_CLIENT_CLIENT_ID ?? "",
      redirectUri: process.env.IMJS_AUTH_CLIENT_REDIRECT_URI ?? "",
      postSignoutRedirectUri: process.env.IMJS_AUTH_CLIENT_LOGOUT_URI,
      responseType: "code",
      authority: process.env.IMJS_AUTH_AUTHORITY,
    }),
    state: AuthorizationState.Pending,
  }));

  const authClient = contextValue.client;
  useEffect(() => {
    return authClient.onAccessTokenChanged.addListener(() => setContextValue((prev) => ({ ...prev, state: AuthorizationState.Authorized })));
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

