/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import cx from "classnames";
import { forwardRef } from "react";
import { TreeNodeRenderer as CoreTreeNodeRenderer } from "@itwin/presentation-hierarchies-react";
import { TreeNodeCheckbox } from "./TreeNodeCheckbox";

import type { ComponentPropsWithoutRef, ForwardRefExoticComponent, RefAttributes } from "react";
import type { TreeCheckboxProps } from "./TreeNodeCheckbox";

/** @beta */
export type TreeNodeRendererProps = ComponentPropsWithoutRef<typeof CoreTreeNodeRenderer> & {
  /** Props for rendering tree node checkbox. If not provided, checkbox is not rendered. */
  checkboxProps?: TreeCheckboxProps;
};

/** @beta */
export const TreeNodeRenderer: ForwardRefExoticComponent<TreeNodeRendererProps & RefAttributes<HTMLDivElement>> = forwardRef(
  ({ checkboxProps, ...props }: TreeNodeRendererProps, forwardedRef) => {
    return (
      <CoreTreeNodeRenderer
        {...props}
        ref={forwardedRef}
        nodeProps={{ className: cx("tw-tree-node", props.isSelected && "selected", props.className) }}
        actionButtonsClassName="tw-tree-node-action-buttons"
        checkbox={checkboxProps ? <TreeNodeCheckbox {...checkboxProps} node={props.node} /> : null}
        contentProps={{ className: "tw-tree-node-content" }}
        checkboxProps={{ className: "tw-tree-node-checkbox-container" }}
      />
    );
  },
);
TreeNodeRenderer.displayName = "TreeNodeRenderer";
