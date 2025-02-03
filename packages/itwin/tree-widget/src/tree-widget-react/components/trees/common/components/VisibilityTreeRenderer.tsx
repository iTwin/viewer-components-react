/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
/* eslint-disable @itwin/no-internal */

import { useMemo } from "react";
import { TreeRenderer } from "./TreeRenderer.js";
import { useVisibilityButtonHandler } from "./UseVisibilityButtonHandler.js";

import type { TreeRendererProps } from "./TreeRenderer.js";
import type { TreeItemVisibilityButtonProps } from "./TreeNodeVisibilityButton.js";
/** @beta */
export type VisibilityTreeRendererProps = TreeRendererProps & TreeItemVisibilityButtonProps;

/**
 * Tree renderer that renders tree nodes with eye checkboxes for controlling visibility of instances represented by tree nodes.
 * @beta
 */
export function VisibilityTreeRenderer({ getVisibilityButtonState, onVisibilityButtonClick: onClick, ...props }: VisibilityTreeRendererProps) {
  const { onVisibilityButtonClick } = useVisibilityButtonHandler({ rootNodes: props.rootNodes, isNodeSelected: props.isNodeSelected, onClick });
  const visibilityButtonProps: TreeItemVisibilityButtonProps = useMemo(
    () => ({
      variant: "eyeball",
      getVisibilityButtonState,
      onVisibilityButtonClick,
    }),
    [getVisibilityButtonState, onVisibilityButtonClick],
  );

  return <TreeRenderer {...props} visibilityButtonProps={visibilityButtonProps} />;
}
