/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { useEffect, useState } from "react";
import { HierarchyNode } from "@itwin/presentation-hierarchies-react";
import { Selectable, Selectables } from "@itwin/unified-selection";
import { focusedInstancesContext } from "./FocusedInstancesContext";

import type { SelectionStorage } from "@itwin/presentation-hierarchies-react";
import type { PropsWithChildren } from "react";
import type { InstanceKey } from "@itwin/presentation-common";
import type { FocusedInstancesContext } from "./FocusedInstancesContext";
import type { GroupingHierarchyNode } from "@itwin/presentation-hierarchies";

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
      setState((prev) => ({ ...prev, loadInstanceKeys: undefined }));
      return;
    }

    const onSelectionChanged = () => {
      const selection = selectionStorage.getSelection({ imodelKey, level: 0 });
      if (Selectables.isEmpty(selection)) {
        setState((prev) => ({ ...prev, loadInstanceKeys: undefined }));
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

      const loadInstanceKeys: () => AsyncIterableIterator<InstanceKey | GroupingHierarchyNode> = async function* () {
        for (const item of selected) {
          if (typeof item === "function") {
            yield* item();
          } else {
            yield item;
          }
        }
      };

      setState((prev) => ({ ...prev, loadInstanceKeys }));
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
