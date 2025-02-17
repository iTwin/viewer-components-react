/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
/* eslint-disable @itwin/no-internal */

import { createFilterAction } from "@itwin/presentation-hierarchies-react";
import { BaseTreeRenderer } from "./BaseTreeRenderer.js";

/** @beta */
export type TreeRendererProps = React.ComponentPropsWithoutRef<typeof BaseTreeRenderer>;

/**
 * Default renderer for rendering tree data.
 * @beta
 */
export function TreeRenderer({ actions, ...props }: TreeRendererProps) {
  return (
    <BaseTreeRenderer
      {...props}
      actions={[
        createFilterAction({ onFilter: props.onFilterClick, getHierarchyLevelDetails: props.getHierarchyLevelDetails, label: "Filter" }),
        ...(actions ? actions : []),
      ]}
    />
  );
}
