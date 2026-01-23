/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { useCallback } from "react";
import { Icon } from "@stratakit/foundations";
import categorySvg from "@stratakit/icons/bis-category-3d.svg";
import classSvg from "@stratakit/icons/bis-class.svg";
import elementSvg from "@stratakit/icons/bis-element.svg";
import subjectSvg from "@stratakit/icons/bis-subject.svg";
import groupSvg from "@stratakit/icons/group.svg";
import modelSvg from "@stratakit/icons/model-cube.svg";
import hierarchyTreeSvg from "@stratakit/icons/selection-children.svg";
import { EmptyTreeContent } from "../common/components/EmptyTree.js";
import { Tree } from "../common/components/Tree.js";
import { TreeRenderer } from "../common/components/TreeRenderer.js";
import { useGuid } from "../common/internal/useGuid.js";
import { IModelContentTreeComponent } from "./IModelContentTreeComponent.js";
import { defaultHierarchyConfiguration, IModelContentTreeDefinition } from "./IModelContentTreeDefinition.js";
import { IModelContentTreeIdsCache } from "./internal/IModelContentTreeIdsCache.js";

import type { TreeNode } from "@itwin/presentation-hierarchies-react";
import type { TreeProps } from "../common/components/Tree.js";
import type { ExtendedTreeRendererProps } from "../common/components/TreeRenderer.js";
import type { IModelContentTreeHierarchyConfiguration } from "./IModelContentTreeDefinition.js";

/** @beta */
export type IModelContentTreeProps = Pick<
  ExtendedTreeRendererProps,
  "getInlineActions" | "getMenuActions" | "getContextMenuActions" | "getTreeItemProps" | "treeLabel"
> &
  Pick<TreeProps, "imodel" | "selectionStorage" | "selectionMode" | "emptyTreeContent"> & {
    hierarchyLevelConfig?: {
      sizeLimit?: number;
    };
    hierarchyConfig?: Partial<IModelContentTreeHierarchyConfiguration>;
  };

/** @beta */
export function IModelContentTree({
  getInlineActions,
  getMenuActions,
  getContextMenuActions,
  getTreeItemProps,
  selectionMode,
  treeLabel,
  hierarchyConfig: hierarchyConfigProp,
  ...rest
}: IModelContentTreeProps) {
  const componentId = useGuid();
  const getHierarchyDefinition = useCallback<TreeProps["getHierarchyDefinition"]>(
    ({ imodelAccess }) => {
      const hierarchyConfig = {
        ...defaultHierarchyConfiguration,
        ...hierarchyConfigProp,
      };
      return new IModelContentTreeDefinition({ imodelAccess, idsCache: new IModelContentTreeIdsCache(imodelAccess, componentId), hierarchyConfig });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    Object.values({ ...(hierarchyConfigProp ?? {}), componentId }),
  );

  return (
    <Tree
      emptyTreeContent={<EmptyTreeContent icon={modelSvg} />}
      {...rest}
      treeName={IModelContentTreeComponent.id}
      getHierarchyDefinition={getHierarchyDefinition}
      selectionMode={selectionMode ?? "extended"}
      treeRenderer={(treeProps) => (
        <TreeRenderer
          {...treeProps}
          treeLabel={treeLabel}
          getInlineActions={getInlineActions ? (node) => getInlineActions(node, treeProps) : undefined}
          getMenuActions={getMenuActions ? (node) => getMenuActions(node, treeProps) : undefined}
          getContextMenuActions={getContextMenuActions ? (node) => getContextMenuActions(node, treeProps) : undefined}
          getTreeItemProps={(node) => ({
            decorations: <IModelContentTreeIcon node={node} />,
            ...(getTreeItemProps ? getTreeItemProps(node, treeProps) : {}),
          })}
        />
      )}
    />
  );
}

/** @beta */
export function IModelContentTreeIcon({ node }: { node: TreeNode }) {
  if (node.nodeData.extendedData?.imageId === undefined) {
    return undefined;
  }

  const getIcon = () => {
    switch (node.nodeData.extendedData!.imageId) {
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
