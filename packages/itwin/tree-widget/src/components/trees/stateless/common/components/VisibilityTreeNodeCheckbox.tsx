/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { Checkbox } from "@itwin/itwinui-react";
import { PresentationHierarchyNode, RenderedTreeNode, isPresentationHierarchyNode } from "@itwin/presentation-hierarchies-react";
import { VisibilityStatus } from "../../../VisibilityTreeEventHandler";

interface VisibilityTreeNodeCheckboxProps {
  node: RenderedTreeNode;
  onCheckboxClicked: (node: PresentationHierarchyNode, checked: boolean) => void;
  getCheckboxStatus: (node: PresentationHierarchyNode) => VisibilityStatus;
}

/** @internal */
export function VisibilityTreeNodeCheckbox({ node, onCheckboxClicked, getCheckboxStatus }: VisibilityTreeNodeCheckboxProps) {
  if ("type" in node || !isPresentationHierarchyNode(node)) {
    return null;
  }

  const checkboxStatus = getCheckboxStatus(node);
  return (
    <Checkbox
      className="visibility-tree-node-checkbox"
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
}
