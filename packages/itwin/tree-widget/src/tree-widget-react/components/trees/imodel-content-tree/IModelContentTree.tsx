/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/


import { EmptyTreeContent } from "../common/components/EmptyTreeContent.js";
import { Tree } from "../common/components/Tree.js";
import { TreeRenderer } from "../common/components/TreeRenderer.js";
import { IModelContentTreeComponent } from "./IModelContentTreeComponent.js";
import { IModelContentTreeDefinition } from "./IModelContentTreeDefinition.js";
import { IModelContentTreeIdsCache } from "./internal/IModelContentTreeIdsCache.js";

import type { PresentationHierarchyNode } from "@itwin/presentation-hierarchies-react";
import type { BaseTreeRendererProps } from "../common/components/BaseTreeRenderer.js";
import type { TreeProps } from "../common/components/Tree.js";

/** @beta */
export type IModelContentTreeProps = Pick<TreeProps, "imodel" | "getSchemaContext" | "selectionStorage" | "selectionMode" | "emptyTreeContent"> &
  Pick<BaseTreeRendererProps, "actions"> & {
    hierarchyLevelConfig?: {
      sizeLimit?: number;
    };
  };

/** @beta */
export function IModelContentTree(props: IModelContentTreeProps) {
  return (
    <Tree
      emptyTreeContent={<EmptyTreeContent icon={modelIcon} />}
      {...props}
      treeName={IModelContentTreeComponent.id}
      getHierarchyDefinition={getDefinitionsProvider}
      selectionMode={props.selectionMode ?? "extended"}
      treeRenderer={(treeProps) => <TreeRenderer {...treeProps} getIcon={getIcon} />}
    />
  );
}

const getDefinitionsProvider: TreeProps["getHierarchyDefinition"] = ({ imodelAccess }) => {
  return new IModelContentTreeDefinition({
    imodelAccess,
    idsCache: new IModelContentTreeIdsCache(imodelAccess),
  });
};

const subjectIcon = new URL("@itwin/itwinui-icons/bis-subject.svg", import.meta.url).href;
const classIcon = new URL("@itwin/itwinui-icons/bis-class.svg", import.meta.url).href;
const modelIcon = new URL("@itwin/itwinui-icons/model-cube.svg", import.meta.url).href;
const categoryIcon = new URL("@itwin/itwinui-icons/bis-category-3d.svg", import.meta.url).href;
const elementIcon = new URL("@itwin/itwinui-icons/bis-element.svg", import.meta.url).href;
const hierarchyTreeIcon = new URL("@itwin/itwinui-icons/selection-children.svg", import.meta.url).href;
const groupIcon = new URL("@itwin/itwinui-icons/group.svg", import.meta.url).href;

function getIcon(node: PresentationHierarchyNode): string | undefined {
  if (node.extendedData?.imageId === undefined) {
    return undefined;
  }

  switch (node.extendedData.imageId) {
    case "icon-layers":
      return categoryIcon;
    case "icon-item":
      return elementIcon;
    case "icon-ec-class":
      return classIcon;
    case "icon-folder":
      return subjectIcon;
    case "icon-model":
      return modelIcon;
    case "icon-hierarchy-tree":
      return hierarchyTreeIcon;
    case "icon-group":
      return groupIcon;
  }

  return undefined;
}
