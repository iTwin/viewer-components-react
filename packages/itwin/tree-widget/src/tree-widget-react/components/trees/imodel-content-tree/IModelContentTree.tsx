/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { Icon } from "@itwin/itwinui-react/bricks";
import { EmptyTreeContent } from "../common/components/EmptyTree.js";
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
  Pick<BaseTreeRendererProps, "actions" | "getDecorations"> & {
    hierarchyLevelConfig?: {
      sizeLimit?: number;
    };
  };

/** @beta */
export function IModelContentTree({ actions, getDecorations, selectionMode, ...rest }: IModelContentTreeProps) {
  return (
    <Tree
      emptyTreeContent={<EmptyTreeContent icon={modelSvg} />}
      {...rest}
      treeName={IModelContentTreeComponent.id}
      getHierarchyDefinition={getDefinitionsProvider}
      selectionMode={selectionMode ?? "extended"}
      treeRenderer={(treeProps) => (
        <TreeRenderer {...treeProps} actions={actions} getDecorations={getDecorations ?? ((node) => <IModelContentTreeIcon node={node} />)} />
      )}
    />
  );
}

const getDefinitionsProvider: TreeProps["getHierarchyDefinition"] = ({ imodelAccess }) => {
  return new IModelContentTreeDefinition({
    imodelAccess,
    idsCache: new IModelContentTreeIdsCache(imodelAccess),
  });
};

const categorySvg = new URL("@itwin/itwinui-icons/bis-category-3d.svg", import.meta.url).href;
const classSvg = new URL("@itwin/itwinui-icons/bis-class.svg", import.meta.url).href;
const elementSvg = new URL("@itwin/itwinui-icons/bis-element.svg", import.meta.url).href;
const subjectSvg = new URL("@itwin/itwinui-icons/bis-subject.svg", import.meta.url).href;
const groupSvg = new URL("@itwin/itwinui-icons/group.svg", import.meta.url).href;
const modelSvg = new URL("@itwin/itwinui-icons/model-cube.svg", import.meta.url).href;
const hierarchyTreeSvg = new URL("@itwin/itwinui-icons/selection-children.svg", import.meta.url).href;

/** @beta */
export function IModelContentTreeIcon({ node }: { node: PresentationHierarchyNode }) {
  if (node.extendedData?.imageId === undefined) {
    return undefined;
  }

  const getIcon = () => {
    switch (node.extendedData!.imageId) {
      case "icon-layers":
        return categorySvg;
      case "icon-item":
        return elementSvg;
      case "icon-ec-class":
        return classSvg;
      case "icon-folder":
        return subjectSvg;
      case "icon-model":
        return modelSvg;
      case "icon-hierarchy-tree":
        return hierarchyTreeSvg;
      case "icon-group":
        return groupSvg;
      default:
        return undefined;
    }
  };

  return <Icon href={getIcon()} />;
}
