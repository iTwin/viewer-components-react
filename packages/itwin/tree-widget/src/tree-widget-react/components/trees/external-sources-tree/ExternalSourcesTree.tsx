/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { Icon } from "@stratakit/foundations";
import classSvg from "@stratakit/icons/bis-class.svg";
import elementSvg from "@stratakit/icons/bis-element.svg";
import documentSvg from "@stratakit/icons/document.svg";
import ecSchemaSvg from "@stratakit/icons/selection-children.svg";
import { EmptyTreeContent } from "../common/components/EmptyTree.js";
import { Tree } from "../common/components/Tree.js";
import { TreeRenderer } from "../common/components/TreeRenderer.js";
import { ExternalSourcesTreeComponent } from "./ExternalSourcesTreeComponent.js";
import { ExternalSourcesTreeDefinition } from "./ExternalSourcesTreeDefinition.js";

import type { PresentationHierarchyNode } from "@itwin/presentation-hierarchies-react";
import type { BaseTreeRendererProps } from "../common/components/BaseTreeRenderer.js";
import type { TreeProps } from "../common/components/Tree.js";

/** @beta */
export type ExternalSourcesTreeProps = Pick<TreeProps, "imodel" | "selectionStorage" | "selectionMode" | "emptyTreeContent"> &
  Pick<BaseTreeRendererProps, "getInlineActions" | "getMenuActions" | "getDecorations"> & {
    hierarchyLevelConfig?: {
      sizeLimit?: number;
    };
  };

/** @beta */
export function ExternalSourcesTree({ getInlineActions, getMenuActions, getDecorations, selectionMode, ...rest }: ExternalSourcesTreeProps) {
  return (
    <Tree
      emptyTreeContent={<EmptyTreeContent icon={documentSvg} />}
      {...rest}
      treeName={ExternalSourcesTreeComponent.id}
      getHierarchyDefinition={getDefinitionsProvider}
      selectionMode={selectionMode ?? "none"}
      treeRenderer={(treeProps) => (
        <TreeRenderer
          {...treeProps}
          getInlineActions={getInlineActions}
          getMenuActions={getMenuActions}
          getDecorations={getDecorations ?? ((node) => <ExternalSourcesTreeIcon node={node} />)}
        />
      )}
    />
  );
}

const getDefinitionsProvider: TreeProps["getHierarchyDefinition"] = (props) => {
  return new ExternalSourcesTreeDefinition(props);
};

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
