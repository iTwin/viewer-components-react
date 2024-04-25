/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { PresentationHierarchyNode, TreeNodeRenderer, isPresentationHierarchyNode } from "@itwin/presentation-hierarchies-react";
import { ComponentPropsWithoutRef } from "react";
import { VisibilityStatus } from "../../../VisibilityTreeEventHandler";
import { Checkbox } from "@itwin/itwinui-react";

type TreeNodeRendererProps = ComponentPropsWithoutRef<typeof TreeNodeRenderer>;

type VisibilityTreeNodeRendererProps = TreeNodeRendererProps & {
  onCheckboxClicked: (node: PresentationHierarchyNode, checked: boolean) => void;
  getCheckboxStatus: (node: PresentationHierarchyNode) => VisibilityStatus;
};

/** @internal */
export function VisibilityTreeNodeRenderer({ onCheckboxClicked, getCheckboxStatus, ...restProps }: VisibilityTreeNodeRendererProps) {
  const renderCheckbox = () => {
    const node = restProps.node;
    if (!isPresentationHierarchyNode(node)) {
      return null;
    }

    const checkboxStatus = getCheckboxStatus(node);
    return (
      <Checkbox
        variant="eyeball"
        checked={checkboxStatus.state === "visible"}
        onClick={(e) => {
          e.stopPropagation();
        }}
        onChange={(e) => {
          onCheckboxClicked(node, e.currentTarget.checked);
        }}
        indeterminate={checkboxStatus.state === "partial"}
        disabled={checkboxStatus.isDisabled}
        title={checkboxStatus.tooltip}
      />
    );
  };
  return <TreeNodeRenderer {...restProps} checkbox={renderCheckbox()} />;
}
