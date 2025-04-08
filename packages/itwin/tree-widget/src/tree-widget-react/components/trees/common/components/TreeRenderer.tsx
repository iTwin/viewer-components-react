/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
/* eslint-disable @itwin/no-internal */

import { useMemo } from "react";
import { useFilterAction } from "@itwin/presentation-hierarchies-react";
import { BaseTreeRenderer } from "./BaseTreeRenderer.js";

import type { BaseTreeRendererProps } from "./BaseTreeRenderer.js";
/**
 * Default renderer for rendering tree data.
 * @beta
 */
export function TreeRenderer({ actions, ...props }: BaseTreeRendererProps) {
  const filterAction = useFilterAction({ onFilter: props.onFilterClick, getHierarchyLevelDetails: props.getHierarchyLevelDetails });
  const nodeActions = useMemo(() => {
    return [filterAction, ...(actions ? actions : [])];
  }, [filterAction, actions]);

  return <BaseTreeRenderer {...props} actions={nodeActions} />;
}
