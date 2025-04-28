/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import "./TreeNodeVisibilityButton.css";
import { memo } from "react";
import { Tree } from "@itwin/itwinui-react/bricks";
import { createTooltip } from "../internal/Tooltip.js";

import type { PresentationHierarchyNode } from "@itwin/presentation-hierarchies-react";

/**
 * Data structure that describes tree node checkbox state.
 * @beta
 */
export interface TreeItemVisibilityButtonState {
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

const visibilityHideSvg = new URL("@itwin/itwinui-icons/visibility-hide.svg", import.meta.url).href;
const visibilityPartialSvg = new URL("@itwin/itwinui-icons/visibility-partial.svg", import.meta.url).href;
const visibilityShowSvg = new URL("@itwin/itwinui-icons/visibility-show.svg", import.meta.url).href;

/** @internal */
export const VisibilityAction = memo(function VisibilityAction({
  getVisibilityButtonState,
  onVisibilityButtonClick,
  node,
}: TreeItemVisibilityButtonProps & { node: PresentationHierarchyNode }) {
  const state = getVisibilityButtonState(node);

  const getIcon = () => {
    switch (state.state) {
      case "visible":
        return visibilityShowSvg;
      case "hidden":
        return visibilityHideSvg;
      case "partial":
        return visibilityPartialSvg;
    }
  };

  return (
    <Tree.ItemAction
      label={state.tooltip ?? createTooltip(state.state)}
      onClick={() => onVisibilityButtonClick(node, state.state)}
      visible={state.state !== "visible" ? true : undefined}
      icon={getIcon()}
    />
  );
});
