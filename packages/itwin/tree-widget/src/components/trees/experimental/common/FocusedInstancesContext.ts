/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { createContext, useContext } from "react";
import { InstanceKey } from "@itwin/presentation-shared";

/** @internal */
export interface FocusedInstancesContext {
  instanceKeys?: InstanceKey[];
  enabled: boolean;
  toggle: () => void;
}

/** @internal */
export const focusedInstancesContext = createContext<FocusedInstancesContext>({ enabled: false, toggle: () => {} });

/** @internal */
export function useFocusedInstancesContext() {
  return useContext(focusedInstancesContext);
}
