/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { SvgFolder, SvgGroup, SvgHierarchyTree, SvgImodelHollow, SvgItem, SvgLayers, SvgModel } from "@itwin/itwinui-icons-react";
import { Tree } from "../common/components/Tree";
import { TreeRenderer } from "../common/components/TreeRenderer";
import { IModelContentTreeComponent } from "./IModelContentTreeComponent";
import { IModelContentTreeDefinition } from "./IModelContentTreeDefinition";
import { IModelContentTreeIdsCache } from "./internal/IModelContentTreeIdsCache";

import type { TreeProps } from "../common/components/Tree";
import type { ReactElement } from "react";
import type { PresentationHierarchyNode } from "@itwin/presentation-hierarchies-react";

/** @beta */
export type IModelContentTreeProps = Pick<TreeProps, "imodel" | "getSchemaContext" | "selectionStorage" | "density" | "selectionMode"> & {
  hierarchyLevelConfig?: {
    sizeLimit?: number;
  };
};

/** @beta */
export function IModelContentTree(props: IModelContentTreeProps) {
  return (
    <Tree
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

function getIcon(node: PresentationHierarchyNode): ReactElement | undefined {
  if (node.extendedData?.imageId === undefined) {
    return undefined;
  }

  switch (node.extendedData.imageId) {
    case "icon-layers":
      return <SvgLayers />;
    case "icon-item":
      return <SvgItem />;
    case "icon-ec-class":
      return <SvgItem />;
    case "icon-imodel-hollow-2":
      return <SvgImodelHollow />;
    case "icon-folder":
      return <SvgFolder />;
    case "icon-model":
      return <SvgModel />;
    case "icon-hierarchy-tree":
      return <SvgHierarchyTree />;
    case "icon-group":
      return <SvgGroup />;
  }

  return undefined;
}
