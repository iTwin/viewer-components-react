/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { useEffect } from "react";
import { registerTxnListeners } from "@itwin/presentation-core-interop";

import type { IModelConnection } from "@itwin/core-frontend";

interface UseIModelChangeListenerProps {
  imodel: IModelConnection;
  action: () => void;
}

/** @internal */
export function useIModelChangeListener({ imodel, action }: UseIModelChangeListenerProps) {
  useEffect(() => {
    if (!imodel.isBriefcaseConnection()) {
      return;
    }

    registerTxnListeners(imodel.txns, action);
  }, [imodel, action]);
}
