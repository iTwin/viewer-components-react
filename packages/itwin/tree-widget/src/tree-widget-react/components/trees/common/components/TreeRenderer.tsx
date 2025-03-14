/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
/* eslint-disable @itwin/no-internal */

import { useFilterAction } from "@itwin/presentation-hierarchies-react";
import { BaseTreeRenderer } from "./BaseTreeRenderer.js";

import type { BaseTreeRendererProps } from "./BaseTreeRenderer.js";

/**
 * Default renderer for rendering tree data.
 * @beta
 */
export function TreeRenderer({ actions, ...props }: BaseTreeRendererProps) {
  const filterAction = useFilterAction({ onFilter: props.onFilterClick, getHierarchyLevelDetails: props.getHierarchyLevelDetails });
  return <BaseTreeRenderer {...props} actions={[filterAction, ...(actions ? actions : [])]} />;
}
