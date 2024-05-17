/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { ComponentPropsWithoutRef } from "react";
import cx from "classnames";
import { TreeNodeRenderer } from "@itwin/presentation-hierarchies-react";
import { VisibilityTreeNodeCheckbox } from "./VisibilityTreeNodeCheckbox";

type VisibilityTreeNodeCheckboxProps = ComponentPropsWithoutRef<typeof VisibilityTreeNodeCheckbox>;
type TreeNodeRendererProps = ComponentPropsWithoutRef<typeof TreeNodeRenderer>;

type VisibilityTreeNodeRendererProps = TreeNodeRendererProps & Pick<VisibilityTreeNodeCheckboxProps, "onCheckboxClicked" | "getCheckboxStatus">;

/** @internal */
export function VisibilityTreeNodeRenderer({ onCheckboxClicked, getCheckboxStatus, ...restProps }: VisibilityTreeNodeRendererProps) {
  return (
    <TreeNodeRenderer
      {...restProps}
      className={cx("visibility-tree-node", restProps.isSelected && "selected")}
      actionButtonsClassName="visibility-tree-node-action-buttons"
      checkbox={<VisibilityTreeNodeCheckbox node={restProps.node} onCheckboxClicked={onCheckboxClicked} getCheckboxStatus={getCheckboxStatus} />}
    />
  );
}
