/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { RepositoriesTree } from "./components/repositories-tree/RepositoriesTree";

export function TestRepositoriesTree() {
  const iTwinId = import.meta.env.IMJS_ITWIN_ID;

  if (!iTwinId) {
    return <> No itwin id found</>;
  }

  return <RepositoriesTree itwinId={iTwinId} environment={"QA"} />;
}
