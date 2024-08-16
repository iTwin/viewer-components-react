/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { createContext, useContext } from "react";

import type { InstanceKey } from "@itwin/presentation-shared";
import type { GroupingHierarchyNode } from "@itwin/presentation-hierarchies";

export interface FocusedInstancesContext {
  loadFocusedItems?: () => AsyncIterableIterator<InstanceKey | GroupingHierarchyNode>;
  enabled: boolean;
  toggle: () => void;
}

export const focusedInstancesContext = createContext<FocusedInstancesContext>({ enabled: false, toggle: () => {} });

export function useFocusedInstancesContext() {
  return useContext(focusedInstancesContext);
}
