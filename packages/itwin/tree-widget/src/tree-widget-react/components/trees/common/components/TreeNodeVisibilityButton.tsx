/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import "./TreeNodeVisibilityButton.css";

import { createContext, memo, useContext, useMemo } from "react";
import { TreeActionBase } from "@itwin/presentation-hierarchies-react";
import visibilityHideSvg from "@stratakit/icons/visibility-hide.svg";
import visibilityPartialSvg from "@stratakit/icons/visibility-partial.svg";
import visibilityShowSvg from "@stratakit/icons/visibility-show.svg";
import { TreeWidget } from "../../../../TreeWidget.js";
import { createTooltip } from "../internal/Tooltip.js";

import type { PropsWithChildren } from "react";
import type { PresentationHierarchyNode, TreeActionBaseAttributes } from "@itwin/presentation-hierarchies-react";

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

/**
 * React component that renders a visibility action for a tree item.
 * Should be used with `VisibilityTreeRenderer`.
 * @beta
 */
export const VisibilityAction = memo(function VisibilityAction({ node, ...actionAttributes }: { node: PresentationHierarchyNode } & TreeActionBaseAttributes) {
  const context = useVisibilityContext();
  const state = context?.getVisibilityButtonState(node);

  if (!context || !state || ("isDisabled" in state && state.isDisabled) || "isLoading" in state) {
    return (
      <TreeActionBase
        {...actionAttributes}
        label={TreeWidget.translate(`visibilityTooltips.status.disabled`)}
        visible={false}
        icon={visibilityShowSvg}
        hide={true}
      />
    );
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
    <TreeActionBase
      {...actionAttributes}
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
