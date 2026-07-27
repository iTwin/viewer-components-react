/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { Icon } from "@stratakit/mui";
import icon3d from "@stratakit/icons/3d.svg";
import iconBisDefinitionsContainer from "@stratakit/icons/bis-definitions-container.svg";
import { ClassificationsTreeNode } from "./ClassificationsTreeNode.js";

import type { TreeNode } from "@itwin/presentation-hierarchies-react";

/** @beta */
export function ClassificationsTreeIcon({ node }: { node: TreeNode }) {
  const nodeType = ClassificationsTreeNode.getType(node.nodeData);
  if (nodeType === undefined) {
    return undefined;
  }

  const getIcon = () => {
    // FIXME: icons...
    switch (nodeType) {
      case "classification-table":
        return iconBisDefinitionsContainer;
      case "classification":
        return iconBisDefinitionsContainer;
      case "element":
        return icon3d;
    }
  };

  return <Icon href={getIcon()} />;
}
