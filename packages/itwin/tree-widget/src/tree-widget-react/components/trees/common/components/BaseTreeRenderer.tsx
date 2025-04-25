/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
/* eslint-disable @itwin/no-internal */

import { TreeRenderer as PresentationTree } from "@itwin/presentation-hierarchies-react";
import { useHierarchiesLocalization } from "../internal/UseHierarchiesLocalization.js";

/** @beta */
export type BaseTreeRendererProps = React.ComponentPropsWithoutRef<typeof PresentationTree>;

/** @internal */
export function BaseTreeRenderer({ rootNodes, onNodeClick, expandNode, getActions, ...props }: BaseTreeRendererProps) {
  const localizedStrings = useHierarchiesLocalization();
  return (
    <PresentationTree
      {...props}
      onNodeClick={onNodeClick}
      localizedStrings={localizedStrings}
      expandNode={expandNode}
      rootNodes={rootNodes}
      getActions={getActions}
    />
  );
}
