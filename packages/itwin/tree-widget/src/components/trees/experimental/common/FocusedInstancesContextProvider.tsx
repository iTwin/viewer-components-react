/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { InstanceKey } from "@itwin/presentation-common";
import { SelectionStorage } from "@itwin/presentation-hierarchies-react";
import { PropsWithChildren, useEffect, useState } from "react";
import { Selectable, Selectables } from "@itwin/unified-selection";
import { FocusedInstancesContext, focusedInstancesContext } from "./FocusedInstancesContext";

/** @internal */
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
      setState((prev) => ({ ...prev, instanceKeys: undefined }));
      return;
    }

    const onSelectionChanged = () => {
      const selection = selectionStorage.getSelection({ imodelKey, level: 0 });
      const selectedInstanceKeys: InstanceKey[] = [];
      Selectables.forEach(selection, (key) => {
        if (Selectable.isInstanceKey(key)) {
          selectedInstanceKeys.push(key);
        }
      });
      setState((prev) => ({ ...prev, instanceKeys: selectedInstanceKeys.length === 0 ? undefined : selectedInstanceKeys }));
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
