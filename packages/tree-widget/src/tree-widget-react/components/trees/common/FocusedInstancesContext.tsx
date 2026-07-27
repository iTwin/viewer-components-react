/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { createContext, useContext, useEffect, useState } from "react";
import { HierarchyNode } from "@itwin/presentation-hierarchies-react";
import { Selectable, Selectables } from "@itwin/unified-selection";

import type { PropsWithChildren } from "react";
import type { GroupingHierarchyNode } from "@itwin/presentation-hierarchies";
import type { SelectionStorage } from "@itwin/presentation-hierarchies-react";
import type { InstanceKey } from "@itwin/presentation-shared";

/** @public */
interface FocusedInstancesContext {
  /**
   * A function, returning an async iterator of items that should be focused. The function is not set
   * when instances focus mode is disabled or selection is empty.
   */
  loadFocusedItems?: () => AsyncIterableIterator<InstanceKey | GroupingHierarchyNode>;

  /** A flag indicating whether instances focus mode is enabled. */
  enabled: boolean;

  /** Toggle enable or disable instances focus mode. */
  toggle: () => void;
}

const focusedInstancesContext = createContext<FocusedInstancesContext>({ enabled: false, toggle: () => {} });

/**
 * A React hook for getting focused instances context. The context must be provided
 * using `FocusedInstancesContextProvider`.
 *
 * @public
 */
export function useFocusedInstancesContext(): FocusedInstancesContext {
  return useContext(focusedInstancesContext);
}

/**
 * A React context provider for setting up focused instances context, which can then be acquired
 * using `useFocusedInstancesContext` hook.
 *
 * @public
 */
export function FocusedInstancesContextProvider({
  selectionStorage,
  imodelKey,
  children,
}: PropsWithChildren<{ selectionStorage: SelectionStorage; imodelKey: string }>) {
  const [state, setState] = useState<FocusedInstancesContext>({
    enabled: false,
    toggle: () => {
      setState((prev) => ({ ...prev, enabled: !prev.enabled }));
    },
  });
  const enabled = state.enabled;

  useEffect(() => {
    if (!enabled) {
      setState((prev) => ({ ...prev, loadFocusedItems: undefined }));
      return;
    }

    const onSelectionChanged = () => {
      const selection = selectionStorage.getSelection({ imodelKey, level: 0 });
      if (Selectables.isEmpty(selection)) {
        setState((prev) => ({ ...prev, loadFocusedItems: undefined }));
        return;
      }

      const selected: Array<InstanceKey | GroupingHierarchyNode | (() => AsyncIterableIterator<InstanceKey>)> = [];
      Selectables.forEach(selection, (selectable) => {
        if (Selectable.isInstanceKey(selectable)) {
          selected.push(selectable);
          return;
        }

        if (isHierarchyNode(selectable.data) && HierarchyNode.isGroupingNode(selectable.data)) {
          selected.push(selectable.data);
          return;
        }

        selected.push(selectable.loadInstanceKeys);
      });

      const loadFocusedItems: () => AsyncIterableIterator<InstanceKey | GroupingHierarchyNode> = async function* () {
        for (const item of selected) {
          if (typeof item === "function") {
            yield* item();
          } else {
            yield item;
          }
        }
      };

      setState((prev) => ({ ...prev, loadFocusedItems }));
    };

    onSelectionChanged();
    return selectionStorage.selectionChangeEvent.addListener(({ imodelKey: changeImodelKey, level }) => {
      if (changeImodelKey !== imodelKey || level !== 0) {
        return;
      }
      onSelectionChanged();
    });
  }, [enabled, imodelKey, selectionStorage]);

  return <focusedInstancesContext.Provider value={state}>{children}</focusedInstancesContext.Provider>;
}

function isHierarchyNode(data: unknown): data is HierarchyNode {
  return !!data && typeof data === "object" && "key" in data;
}
