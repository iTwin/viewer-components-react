/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { forwardRef } from "react";
import { TreeNodeRenderer as CoreTreeNodeRenderer } from "@itwin/presentation-hierarchies-react";
import { TreeNodeCheckbox } from "./TreeNodeCheckbox.js";

import type { ComponentPropsWithoutRef, ForwardRefExoticComponent, RefAttributes } from "react";
import type { TreeCheckboxProps } from "./TreeNodeCheckbox.js";

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
        nodeProps={{ className: props.className }}
        checkbox={checkboxProps ? <TreeNodeCheckbox {...checkboxProps} node={props.node} /> : null}
      />
    );
  },
);
TreeNodeRenderer.displayName = "TreeNodeRenderer";
