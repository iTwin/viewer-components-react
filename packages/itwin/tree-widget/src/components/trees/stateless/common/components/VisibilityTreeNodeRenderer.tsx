/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import cx from "classnames";
import { TreeNodeRenderer } from "@itwin/presentation-hierarchies-react";
import { VisibilityTreeNodeCheckbox } from "./VisibilityTreeNodeCheckbox";

import type { ComponentPropsWithoutRef } from "react";

type VisibilityTreeNodeCheckboxProps = ComponentPropsWithoutRef<typeof VisibilityTreeNodeCheckbox>;
type TreeNodeRendererProps = ComponentPropsWithoutRef<typeof TreeNodeRenderer>;

type VisibilityTreeNodeRendererProps = TreeNodeRendererProps & Pick<VisibilityTreeNodeCheckboxProps, "onCheckboxClicked" | "getCheckboxStatus">;

/** @internal */
export function VisibilityTreeNodeRenderer({ onCheckboxClicked, getCheckboxStatus, ...restProps }: VisibilityTreeNodeRendererProps) {
  return (
    <TreeNodeRenderer
      {...restProps}
      className={cx("tw-visibility-tree-node", restProps.isSelected && "selected")}
      actionButtonsClassName="tw-visibility-tree-node-action-buttons"
      checkbox={<VisibilityTreeNodeCheckbox node={restProps.node} onCheckboxClicked={onCheckboxClicked} getCheckboxStatus={getCheckboxStatus} />}
    />
  );
}
