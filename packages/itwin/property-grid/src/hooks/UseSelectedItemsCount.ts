/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { useEffect, useState } from "react";
import { getInstancesCount } from "@itwin/presentation-common";
import { Presentation } from "@itwin/presentation-frontend";

import type { IModelConnection } from "@itwin/core-frontend";
import type { ISelectionProvider, SelectionChangeEventArgs } from "@itwin/presentation-frontend";

/**
 * Returns count of items selected in UnifiedSelection.
 * @internal
 */
export function useSelectedItemsNum(imodel: IModelConnection) {
  const [numSelected, setNumSelected] = useState<number | undefined>(() => {
    return getInstancesCount(Presentation.selection.getSelection(imodel, 0));
  });

  useEffect(() => {
    const onSelectionChange = (args: SelectionChangeEventArgs, provider: ISelectionProvider) => {
      if (args.imodel !== imodel || args.level !== 0)
        return;

      const selection = provider.getSelection(imodel, 0);
      setNumSelected(getInstancesCount(selection));
    };

    return Presentation.selection.selectionChange.addListener(onSelectionChange);
  }, [imodel]);

  return numSelected;
}
