/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { RepositoriesTree } from "./components/repositories-tree/RepositoriesTree";
import { useAccessToken } from "./UseAccessToken";

export function TestRepositoriesTree() {
  const { accessToken } = useAccessToken();
  const iTwinId = import.meta.env.IMJS_ITWIN_ID;

  if (!accessToken) {
    return <> No access token</>;
  }

  if (!iTwinId) {
    return <> No itwin id found</>;
  }

  return <RepositoriesTree accessToken={accessToken} itwinId={iTwinId} environment={"QA"} />;
}
