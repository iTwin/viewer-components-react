/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import "./TreeNodeVisibilityButton.css";
import cx from "classnames";
import { IconButton } from "@itwin/itwinui-react/bricks";
import { isPresentationHierarchyNode } from "@itwin/presentation-hierarchies-react";

import type { PresentationHierarchyNode, PresentationTreeNode } from "@itwin/presentation-hierarchies-react";
import type { ComponentPropsWithoutRef } from "react";

const visibilityShowIcon = new URL("@itwin/itwinui-icons/visibility-show.svg", import.meta.url).href;
const visibilityHideIcon = new URL("@itwin/itwinui-icons/visibility-hide.svg", import.meta.url).href;
const visibilityPartialIcon = new URL("@itwin/itwinui-icons/state-inherited-dot.svg", import.meta.url).href;

/**
 * Data structure that describes tree node checkbox state.
 * @beta
 */
interface TreeItemVisibilityButtonState {
  state: "visible" | "partial" | "hidden";
  isDisabled?: boolean;
  tooltip?: string;
}

/** @beta */
export interface TreeItemVisibilityButtonProps {
  /** Callback that should be invoked when checkbox is clicked. */
  onVisibilityButtonClick: (node: PresentationHierarchyNode, state: TreeItemVisibilityButtonState["state"]) => void;
  /** Callback that should be used to determine current checkbox state. */
  getVisibilityButtonState: (node: PresentationHierarchyNode) => TreeItemVisibilityButtonState;
}

/** @internal */
type TreeNodeCheckboxProps = TreeItemVisibilityButtonProps &
  Omit<ComponentPropsWithoutRef<typeof IconButton>, "onClick" | "aria-disabled" | "title" | "label" | "icon">;

/** @internal */
export function TreeItemVisibilityButton({
  node,
  onVisibilityButtonClick,
  getVisibilityButtonState,
  ...props
}: TreeNodeCheckboxProps & { node: PresentationTreeNode }) {
  if ("type" in node || !isPresentationHierarchyNode(node)) {
    return null;
  }
  const checkboxState = getVisibilityButtonState(node);

  const getIcon = () => {
    switch (checkboxState.state) {
      case "visible":
        return visibilityShowIcon;
      case "hidden":
        return visibilityHideIcon;
      case "partial":
        return visibilityPartialIcon;
    }
  };
  return (
    <IconButton
      {...props}
      style={{ position: "relative" }}
      label={checkboxState.tooltip ?? "Determining visibility..."}
      variant={"ghost"}
      className={cx(`tw-tree-node-visibility-button-${checkboxState.state}`, props.className)}
      onClick={(e) => {
        e.stopPropagation();
        onVisibilityButtonClick(node, checkboxState.state);
      }}
      aria-disabled={checkboxState.isDisabled}
      icon={getIcon()}
    />
  );
}
