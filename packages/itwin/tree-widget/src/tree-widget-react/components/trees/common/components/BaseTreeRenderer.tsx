/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
/* eslint-disable @itwin/no-internal */

import { LocalizationContextProvider, TreeRenderer as PresentationTree } from "@itwin/presentation-hierarchies-react";
import { useHierarchiesLocalization } from "../UseHierarchiesLocalization.js";

/** @internal */
export type BaseTreeRendererProps = React.ComponentPropsWithoutRef<typeof PresentationTree>;

/** @internal */
export function BaseTreeRenderer({ rootNodes, onNodeClick, expandNode, actions, ...props }: BaseTreeRendererProps) {
  const localizedStrings = useHierarchiesLocalization();
  return (
    <LocalizationContextProvider localizedStrings={localizedStrings}>
      <PresentationTree {...props} onNodeClick={onNodeClick} expandNode={expandNode} rootNodes={rootNodes} actions={actions} />
    </LocalizationContextProvider>
  );
}
