/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { useEffect, useState } from "react";
import { AuthorizationState, useAuthorizationContext } from "./components/Authorization";

export function useAccessToken() {
  const { state, client } = useAuthorizationContext();
  const [accessToken, setAccessToken] = useState<string | undefined>(undefined);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAccessToken = async () => {
      if (state === AuthorizationState.Pending) {
        setAccessToken(undefined);
        setLoading(true);
        return;
      }

      setLoading(true);
      const token = await client.getAccessToken();
      setAccessToken(token);
      setLoading(false);
    };

    fetchAccessToken();
  }, [state, client]);

  return { accessToken, loading };
}
