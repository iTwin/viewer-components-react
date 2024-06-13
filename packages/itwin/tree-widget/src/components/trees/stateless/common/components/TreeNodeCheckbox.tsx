/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import cx from "classnames";
import { Checkbox } from "@itwin/itwinui-react";
import { isPresentationHierarchyNode } from "@itwin/presentation-hierarchies-react";

import type { PresentationHierarchyNode, RenderedTreeNode } from "@itwin/presentation-hierarchies-react";
import type { ComponentPropsWithoutRef } from "react";

/** @internal */
export interface TreeNodeCheckboxState {
  state: "on" | "off" | "partial";
  isDisabled?: boolean;
  tooltip?: string;
}

interface TreeNodeCheckboxOwnProps {
  node: RenderedTreeNode;
  onCheckboxClicked: (node: PresentationHierarchyNode, checked: boolean) => void;
  getCheckboxState: (node: PresentationHierarchyNode) => TreeNodeCheckboxState;
}

type CheckboxProps = ComponentPropsWithoutRef<typeof Checkbox>;
type TreeNodeCheckboxProps = TreeNodeCheckboxOwnProps & Omit<CheckboxProps, "onClick" | "checked" | "onChange" | "indeterminate" | "disabled" | "title">;

/** @internal */
export function TreeNodeCheckbox({ node, onCheckboxClicked, getCheckboxState, ...props }: TreeNodeCheckboxProps) {
  if ("type" in node || !isPresentationHierarchyNode(node)) {
    return null;
  }

  const checkboxState = getCheckboxState(node);
  return (
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
      title={checkboxState.tooltip}
    />
  );
}
