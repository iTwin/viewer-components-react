/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { useCallback } from "react";
import { FilterAction } from "@itwin/presentation-hierarchies-react";
import { BaseTreeRenderer } from "./BaseTreeRenderer.js";

import type { PresentationHierarchyNode } from "@itwin/presentation-hierarchies-react";
import type { BaseTreeRendererProps } from "./BaseTreeRenderer.js";
/**
 * Default renderer for rendering tree data.
 * @beta
 */
export function TreeRenderer({ getActions, getHierarchyLevelDetails, onFilterClick, ...props }: BaseTreeRendererProps) {
  const nodeActions = useCallback(
    (node: PresentationHierarchyNode) => {
      return [
        <FilterAction key={"Filter"} node={node} onFilter={onFilterClick} getHierarchyLevelDetails={getHierarchyLevelDetails} />,
        ...(getActions ? getActions(node) : []),
      ];
    },
    [onFilterClick, getHierarchyLevelDetails, getActions],
  );

  return <BaseTreeRenderer {...props} onFilterClick={onFilterClick} getHierarchyLevelDetails={getHierarchyLevelDetails} getActions={nodeActions} />;
}
