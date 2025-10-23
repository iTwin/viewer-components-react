/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { useMemo } from "react";
import { useMultiCheckboxHandler } from "../UseMultiCheckboxHandler.js";
import { TreeRenderer } from "./TreeRenderer.js";

import type { TreeCheckboxProps } from "./TreeNodeCheckbox.js";
import type { TreeRendererProps } from "./TreeRenderer.js";

/** @beta */
export type VisibilityTreeRendererProps = TreeRendererProps & TreeCheckboxProps;

/**
 * Tree renderer that renders tree nodes with eye checkboxes for controlling visibility of instances represented by tree nodes.
 * @beta
 */
export function VisibilityTreeRenderer({ getCheckboxState, onCheckboxClicked: onClick, ...props }: VisibilityTreeRendererProps) {
  const { onCheckboxClicked } = useMultiCheckboxHandler({ rootNodes: props.rootNodes, isNodeSelected: props.isNodeSelected, onClick });

  const checkboxProps: TreeRendererProps["checkboxProps"] = useMemo(
    () => ({
      variant: "eyeball",
      getCheckboxState,
      onCheckboxClicked,
    }),
    [getCheckboxState, onCheckboxClicked],
  );

  return <TreeRenderer {...props} checkboxProps={checkboxProps} />;
}
