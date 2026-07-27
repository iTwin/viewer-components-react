/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { Icon } from "@stratakit/mui";
import categorySvg from "@stratakit/icons/bis-category-3d.svg";
import subcategorySvg from "@stratakit/icons/bis-category-subcategory.svg";
import classSvg from "@stratakit/icons/bis-class.svg";
import definitionContainerSvg from "@stratakit/icons/bis-definitions-container.svg";
import elementSvg from "@stratakit/icons/bis-element.svg";
import { CategoriesTreeNode } from "./CategoriesTreeNode.js";

import type { TreeNode } from "@itwin/presentation-hierarchies-react";

/** @beta */
export function CategoriesTreeIcon({ node }: { node: TreeNode }) {
  const nodeType = CategoriesTreeNode.getType(node.nodeData);
  if (nodeType === undefined) {
    return undefined;
  }

  const getIcon = () => {
    switch (nodeType) {
      case "category":
        return categorySvg;
      case "sub-category":
        return subcategorySvg;
      case "definition-container":
        return definitionContainerSvg;
      case "element":
        return elementSvg;
      case "elements-class-group":
        return classSvg;
      default:
        return undefined;
    }
  };

  return <Icon href={getIcon()} />;
}
