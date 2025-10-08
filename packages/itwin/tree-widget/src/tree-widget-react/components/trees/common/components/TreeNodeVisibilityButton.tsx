/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import "./TreeNodeVisibilityButton.css";
import { createContext, memo, useContext, useMemo } from "react";
import visibilityHideSvg from "@stratakit/icons/visibility-hide.svg";
import visibilityPartialSvg from "@stratakit/icons/visibility-partial.svg";
import visibilityShowSvg from "@stratakit/icons/visibility-show.svg";
import { Tree } from "@stratakit/structures";
import { TreeWidget } from "../../../../TreeWidget.js";
import { createTooltip } from "../internal/Tooltip.js";

import type { PropsWithChildren } from "react";
import type { PresentationHierarchyNode } from "@itwin/presentation-hierarchies-react";

/** @beta */
interface LoadedTreeItemVisibilityButtonState {
  state: "visible" | "hidden" | "partial";
  isDisabled?: boolean;
}
/**
 * Data structure that describes tree node checkbox state.
 * @beta
 */
export type TreeItemVisibilityButtonState = (
  | LoadedTreeItemVisibilityButtonState
  | {
      isLoading: true;
    }
) & {
  tooltip?: string;
};

/** @beta */
export interface TreeItemVisibilityButtonProps {
  /**
   * Indicates that space for this action button should be reserved, even when the action is not available.
   * For nodes that don't support visibility, `<VisibilityAction reserveSpace />` renders:
   *
   * - Blank space when the action is used as an inline action. It's recommended to set this prop to keep all action buttons of the same kind vertically aligned.
   * - Disabled menu item when the action is used as a menu action.
   */
  reserveSpace?: true;
}

/**
 * React component that renders a visibility action for a tree item.
 * Should be used with `VisibilityTreeRenderer`.
 * @beta
 */
export const VisibilityAction = memo(function VisibilityAction({ node, reserveSpace }: TreeItemVisibilityButtonProps & { node: PresentationHierarchyNode }) {
  const context = useVisibilityContext();
  const state = context?.getVisibilityButtonState(node);

  if (!context || !state || ("isDisabled" in state && state.isDisabled) || "isLoading" in state) {
    return reserveSpace ? (
      <Tree.ItemAction label={TreeWidget.translate(`visibilityTooltips.status.disabled`)} visible={false} icon={visibilityShowSvg} />
    ) : undefined;
  }

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
      onClick={() => context.onVisibilityButtonClick(node, state.state)}
      visible={state.state !== "visible" ? true : undefined}
      icon={getIcon()}
    />
  );
});

/** @beta */
export interface VisibilityContext {
  /** Callback that should be invoked when checkbox is clicked. */
  onVisibilityButtonClick: (node: PresentationHierarchyNode, state: LoadedTreeItemVisibilityButtonState["state"]) => void;
  /** Callback that should be used to determine current checkbox state. */
  getVisibilityButtonState: (node: PresentationHierarchyNode) => TreeItemVisibilityButtonState;
}

const visibilityContext = createContext<VisibilityContext | undefined>(undefined);

/** @internal */
export const useVisibilityContext = () => {
  return useContext(visibilityContext);
};

/** @internal */
export function VisibilityContextProvider({ onVisibilityButtonClick, getVisibilityButtonState, children }: PropsWithChildren<VisibilityContext>) {
  return (
    <visibilityContext.Provider
      value={useMemo(
        () => ({
          onVisibilityButtonClick,
          getVisibilityButtonState,
        }),
        [getVisibilityButtonState, onVisibilityButtonClick],
      )}
    >
      {children}
    </visibilityContext.Provider>
  );
}
