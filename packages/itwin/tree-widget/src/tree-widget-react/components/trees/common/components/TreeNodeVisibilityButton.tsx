/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import "./TreeNodeVisibilityButton.css";

import type { PresentationHierarchyNode, TreeItemAction } from "@itwin/presentation-hierarchies-react";

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

const visibilityHideSvg = new URL("@itwin/itwinui-icons/visibility-hide.svg", import.meta.url).href;
const visibilityPartialSvg = new URL("@itwin/itwinui-icons/visibility-partial.svg", import.meta.url).href;
const visibilityShowSvg = new URL("@itwin/itwinui-icons/visibility-show.svg", import.meta.url).href;

/** @internal */
export function createVisibilityAction({
  getVisibilityButtonState,
  onVisibilityButtonClick,
}: TreeItemVisibilityButtonProps): (node: PresentationHierarchyNode) => TreeItemAction {
  return (node) => {
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
    return {
      label: state.tooltip ?? "Determining visibility...",
      action: () => {
        onVisibilityButtonClick(node, state.state);
      },
      show: state.state !== "visible" ? true : undefined,
      icon: getIcon(),
    };
  };
}
