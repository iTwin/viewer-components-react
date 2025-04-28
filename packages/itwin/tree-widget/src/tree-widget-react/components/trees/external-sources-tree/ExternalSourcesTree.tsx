/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

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
  Pick<BaseTreeRendererProps, "getActions" | "getDecorations"> & {
    hierarchyLevelConfig?: {
      sizeLimit?: number;
    };
  };

/** @beta */
export function ExternalSourcesTree({ getActions, getDecorations, selectionMode, ...rest }: ExternalSourcesTreeProps) {
  return (
    <Tree
      emptyTreeContent={<EmptyTreeContent icon={documentSvg} />}
      {...rest}
      treeName={ExternalSourcesTreeComponent.id}
      getHierarchyDefinition={getDefinitionsProvider}
      selectionMode={selectionMode ?? "none"}
      treeRenderer={(treeProps) => (
        <TreeRenderer {...treeProps} getActions={getActions} getDecorations={getDecorations ?? ((node) => <ExternalSourcesTreeIcon node={node} />)} />
      )}
    />
  );
}

const getDefinitionsProvider: TreeProps["getHierarchyDefinition"] = (props) => {
  return new ExternalSourcesTreeDefinition(props);
};

const classSvg = new URL("@itwin/itwinui-icons/bis-class.svg", import.meta.url).href;
const elementSvg = new URL("@itwin/itwinui-icons/bis-element.svg", import.meta.url).href;
const documentSvg = new URL("@itwin/itwinui-icons/document.svg", import.meta.url).href;
const ecSchemaSvg = new URL("@itwin/itwinui-icons/selection-children.svg", import.meta.url).href;

/** @beta */
export function ExternalSourcesTreeIcon({ node }: { node: PresentationHierarchyNode }) {
  if (node.nodeData.extendedData?.imageId === undefined) {
    return undefined;
  }
  const getIcon = () => {
    switch (node.nodeData.extendedData!.imageId) {
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
