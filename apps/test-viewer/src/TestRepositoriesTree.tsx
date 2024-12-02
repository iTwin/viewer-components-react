/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { RepositoriesTree } from "@itwin/tree-widget-react";
import { SelectionStorage } from "@itwin/unified-selection";
import { useAccessToken } from "./UseAccessToken";

interface TestRepositoriesTreeProps {
  selectionStorage: SelectionStorage;
}

export function TestRepositoriesTree(props: TestRepositoriesTreeProps) {
  const { accessToken } = useAccessToken();
  const iTwinId = import.meta.env.IMJS_ITWIN_ID;

  if (!accessToken) {
    return <> No access token</>;
  }

  if (!iTwinId) {
    return <> No itwin id found</>;
  }

  return <RepositoriesTree selectionStorage={props.selectionStorage} accessToken={accessToken} itwinId={iTwinId} environment={"QA"} />;
}
