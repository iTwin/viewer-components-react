/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { useEffect, useState } from "react";
import { AccessToken } from "@itwin/core-bentley";
import { AuthorizationState, useAuthorizationContext } from "./components/Authorization";

export function useAccessToken() {
  const { state, client } = useAuthorizationContext();
  const [accessToken, setAccessToken] = useState<string | undefined>(undefined);

  useEffect(() => {
    const fetchAccessToken = async () => {
      if (state === AuthorizationState.Pending) {
        setAccessToken(undefined);
        return;
      }

      const token = await client.getAccessToken();
      setAccessToken(token);
    };

    fetchAccessToken();
  }, [state, client]);

  useEffect(() => {
    const removeListener = client?.onAccessTokenChanged.addListener((token: AccessToken) => {
      setAccessToken(token);
    });
    return () => removeListener();
  }, []);

  return { accessToken };
}
