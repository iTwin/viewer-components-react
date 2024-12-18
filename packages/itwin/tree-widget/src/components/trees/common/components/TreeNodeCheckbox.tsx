/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import cx from "classnames";
import { Checkbox, Tooltip } from "@itwin/itwinui-react";
import { isPresentationHierarchyNode } from "@itwin/presentation-hierarchies-react";

import type { PresentationHierarchyNode, RenderedTreeNode } from "@itwin/presentation-hierarchies-react";
import type { ComponentPropsWithoutRef } from "react";

/**
 * Data structure that describes tree node checkbox state.
 * @beta
 */
interface TreeNodeCheckboxState {
  state: "on" | "off" | "partial";
  isDisabled?: boolean;
  tooltip?: string;
}

/** @beta */
export interface TreeCheckboxProps {
  /** Callback that should be invoked when checkbox is clicked. */
  onCheckboxClicked: (node: PresentationHierarchyNode, checked: boolean) => void;
  /** Callback that should be used to determine current checkbox state. */
  getCheckboxState: (node: PresentationHierarchyNode) => TreeNodeCheckboxState;
}

/** @internal */
type TreeNodeCheckboxProps = TreeCheckboxProps &
  Omit<ComponentPropsWithoutRef<typeof Checkbox>, "onClick" | "checked" | "onChange" | "indeterminate" | "disabled" | "title">;

/** @internal */
export function TreeNodeCheckbox({ node, onCheckboxClicked, getCheckboxState, ...props }: TreeNodeCheckboxProps & { node: RenderedTreeNode }) {
  if ("type" in node || !isPresentationHierarchyNode(node)) {
    return null;
  }

  const checkboxState = getCheckboxState(node);
  return (
    <Tooltip content={checkboxState.tooltip} placement="left">
      <Checkbox
        {...props}
        className={cx("tw-tree-node-checkbox", props.className)}
        checked={checkboxState.state === "on"}
        onClick={(e) => {
          e.stopPropagation();
        }}
        onChange={(e) => {
          onCheckboxClicked(node, e.currentTarget.checked);
        }}
        indeterminate={checkboxState.state === "partial"}
        disabled={checkboxState.isDisabled}
        aria-label={checkboxState.tooltip}
      />
    </Tooltip>
  );
}
