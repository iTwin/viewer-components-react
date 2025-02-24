/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
/* eslint-disable @itwin/no-internal */

import { useMemo } from "react";
import { createFilterAction } from "@itwin/presentation-hierarchies-react";
import { BaseTreeRenderer } from "./BaseTreeRenderer.js";
import { createVisibilityAction } from "./TreeNodeVisibilityButton.js";
import { useVisibilityButtonHandler } from "./UseVisibilityButtonHandler.js";

import type { BaseTreeRendererProps } from "./BaseTreeRenderer.js";
import type { TreeItemVisibilityButtonProps } from "./TreeNodeVisibilityButton.js";
/** @beta */
export type VisibilityTreeRendererProps = BaseTreeRendererProps & TreeItemVisibilityButtonProps;

/**
 * Tree renderer that renders tree nodes with eye checkboxes for controlling visibility of instances represented by tree nodes.
 * @beta
 */
export function VisibilityTreeRenderer({ getVisibilityButtonState, onVisibilityButtonClick: onClick, actions, ...props }: VisibilityTreeRendererProps) {
  const { onVisibilityButtonClick } = useVisibilityButtonHandler({ rootNodes: props.rootNodes, isNodeSelected: props.isNodeSelected, onClick });
  const visibilityButtonProps: TreeItemVisibilityButtonProps = useMemo(
    () => ({
      variant: "eyeball",
      getVisibilityButtonState,
      onVisibilityButtonClick,
    }),
    [getVisibilityButtonState, onVisibilityButtonClick],
  );

  return (
    <BaseTreeRenderer
      {...props}
      actions={[
        ...(visibilityButtonProps ? [createVisibilityAction(visibilityButtonProps)] : []),
        createFilterAction({ onFilter: props.onFilterClick, getHierarchyLevelDetails: props.getHierarchyLevelDetails }),
        ...(actions ? actions : []),
      ]}
    />
  );
}
