/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { Icon } from "@stratakit/foundations";
import categorySvg from "@stratakit/icons/bis-category-3d.svg";
import classSvg from "@stratakit/icons/bis-class.svg";
import elementSvg from "@stratakit/icons/bis-element.svg";
import subjectSvg from "@stratakit/icons/bis-subject.svg";
import imodelSvg from "@stratakit/icons/imodel.svg";
import modelSvg from "@stratakit/icons/model-cube.svg";
import { ModelsTreeNode } from "./ModelsTreeNode.js";

import type { TreeNode } from "@itwin/presentation-hierarchies-react";

/** @beta */
export function ModelsTreeIcon({ node }: { node: TreeNode }) {
  const nodeType = ModelsTreeNode.getType(node.nodeData);
  if (nodeType === undefined) {
    return undefined;
  }

  const getIcon = () => {
    switch (nodeType) {
      case "category":
        return categorySvg;
      case "element":
        return elementSvg;
      case "elements-class-group":
        return classSvg;
      case "subject":
        if (node.nodeData.extendedData?.isRootSubject) {
          return imodelSvg;
        }
        return subjectSvg;
      case "model":
        return modelSvg;
    }
  };

  return <Icon href={getIcon()} />;
}
