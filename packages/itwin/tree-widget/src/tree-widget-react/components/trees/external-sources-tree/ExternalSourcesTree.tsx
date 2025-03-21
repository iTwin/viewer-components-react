/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import React from "react";
import classSvg from "@itwin/itwinui-icons/bis-class.svg";
import elementSvg from "@itwin/itwinui-icons/bis-element.svg";
import documentSvg from "@itwin/itwinui-icons/document.svg";
import ecSchemaSvg from "@itwin/itwinui-icons/selection-children.svg";
import { Icon } from "@itwin/itwinui-react/bricks";
import { EmptyTreeContent } from "../common/components/EmptyTree.js";
import { Tree } from "../common/components/Tree.js";
import { TreeRenderer } from "../common/components/TreeRenderer.js";
import { ExternalSourcesTreeComponent } from "./ExternalSourcesTreeComponent.js";
import { ExternalSourcesTreeDefinition } from "./ExternalSourcesTreeDefinition.js";

import type { PresentationHierarchyNode } from "@itwin/presentation-hierarchies-react";
import type { BaseTreeRendererProps } from "../common/components/BaseTreeRenderer.js";
import type { TreeProps } from "../common/components/Tree.js";
/** @beta */
export type ExternalSourcesTreeProps = Pick<TreeProps, "imodel" | "getSchemaContext" | "selectionStorage" | "selectionMode" | "emptyTreeContent"> &
  Pick<BaseTreeRendererProps, "actions" | "getDecorations"> & {
    hierarchyLevelConfig?: {
      sizeLimit?: number;
    };
  };

/** @beta */
export function ExternalSourcesTree(props: ExternalSourcesTreeProps) {
  return (
    <Tree
      emptyTreeContent={<EmptyTreeContent icon={documentSvg} />}
      {...props}
      treeName={ExternalSourcesTreeComponent.id}
      getHierarchyDefinition={getDefinitionsProvider}
      selectionMode={props.selectionMode ?? "none"}
      treeRenderer={(treeProps) => (
        <TreeRenderer {...treeProps} actions={props.actions} getDecorations={props.getDecorations ?? ((node) => <ExternalSourcesTreeIcon node={node} />)} />
      )}
    />
  );
}

const getDefinitionsProvider: TreeProps["getHierarchyDefinition"] = (props) => {
  return new ExternalSourcesTreeDefinition(props);
};

/** @beta */
export function ExternalSourcesTreeIcon({ node }: { node: PresentationHierarchyNode }) {
  if (node.extendedData?.imageId === undefined) {
    return undefined;
  }
  const getIcon = () => {
    switch (node.extendedData!.imageId) {
      case "icon-item":
        return elementSvg;
      case "icon-ec-class":
        return classSvg;
      case "icon-document":
        return documentSvg;
      case "icon-ec-schema":
        return ecSchemaSvg;
      default:
        return undefined;
    }
  };

  return <Icon href={getIcon()} />;
}
