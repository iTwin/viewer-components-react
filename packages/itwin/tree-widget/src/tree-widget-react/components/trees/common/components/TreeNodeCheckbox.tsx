/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { Checkbox, Tooltip } from "@itwin/itwinui-react";
import { isPresentationHierarchyNode } from "@itwin/presentation-hierarchies-react";

import type { PresentationHierarchyNode, RenderedTreeNode } from "@itwin/presentation-hierarchies-react";
import type { ComponentPropsWithoutRef } from "react";

/**
 * Data structure that describes tree node checkbox state.
 * @beta
 */
type TreeNodeCheckboxState = (
  | {
      state: "on" | "off" | "partial";
      isDisabled?: boolean;
    }
  | {
      isLoading: true;
    }
) & {
  tooltip?: string;
};

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
  const checkboxProps: ComponentPropsWithoutRef<typeof Checkbox> = {
    ...props,
    "aria-label": checkboxState.tooltip,
    onClick: (e) => {
      e.stopPropagation();
    },
    onChange: (e) => {
      onCheckboxClicked(node, e.currentTarget.checked);
    },
  };
  if ("isLoading" in checkboxState) {
    checkboxProps.style = {
      ...checkboxProps.style,
      visibility: "hidden",
    };
  } else {
    checkboxProps.checked = checkboxState.state === "on";
    checkboxProps.indeterminate = checkboxState.state === "partial";
    checkboxProps.disabled = checkboxState.isDisabled;
  }
  return (
    <TooltipWrapper content={checkboxState.tooltip}>
      <Checkbox {...checkboxProps} />
    </TooltipWrapper>
  );
}

function TooltipWrapper({ content, children }: { content?: string; children?: React.ReactNode }) {
  return !!content ? (
    <Tooltip content={content} placement="left">
      {children}
    </Tooltip>
  ) : (
    <>{children}</>
  );
}
