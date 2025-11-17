/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { useCallback } from "react";
import { Icon } from "@stratakit/foundations";
import classSvg from "@stratakit/icons/bis-class.svg";
import elementSvg from "@stratakit/icons/bis-element.svg";
import documentSvg from "@stratakit/icons/document.svg";
import ecSchemaSvg from "@stratakit/icons/selection-children.svg";
import { EmptyTreeContent } from "../common/components/EmptyTree.js";
import { Tree } from "../common/components/Tree.js";
import { TreeRenderer } from "../common/components/TreeRenderer.js";
import { useGuid } from "../common/internal/useGuid.js";
import { ExternalSourcesTreeComponent } from "./ExternalSourcesTreeComponent.js";
import { ExternalSourcesTreeDefinition } from "./ExternalSourcesTreeDefinition.js";

import type { GuidString } from "@itwin/core-bentley";
import type { PresentationHierarchyNode } from "@itwin/presentation-hierarchies-react";
import type { Props } from "@itwin/presentation-shared";
import type { BaseTreeRendererProps } from "../common/components/BaseTreeRenderer.js";
import type { TreeProps } from "../common/components/Tree.js";

/** @beta */
export type ExternalSourcesTreeProps = Pick<TreeProps, "imodel" | "selectionStorage" | "selectionMode" | "emptyTreeContent"> &
  Pick<BaseTreeRendererProps, "getInlineActions" | "getMenuActions" | "getDecorations" | "treeLabel"> & {
    hierarchyLevelConfig?: {
      sizeLimit?: number;
    };
  };

/** @beta */
export function ExternalSourcesTree({ getInlineActions, getMenuActions, getDecorations, selectionMode, treeLabel, ...rest }: ExternalSourcesTreeProps) {
  const componentId = useGuid();
  return (
    <Tree
      emptyTreeContent={<EmptyTreeContent icon={documentSvg} />}
      {...rest}
      treeName={ExternalSourcesTreeComponent.id}
      getHierarchyDefinition={useCallback((definitionProps) => getDefinitionsProvider({ ...definitionProps, componentId }), [componentId])}
      selectionMode={selectionMode ?? "none"}
      treeRenderer={(treeProps) => (
        <TreeRenderer
          {...treeProps}
          treeLabel={treeLabel}
          getInlineActions={getInlineActions}
          getMenuActions={getMenuActions}
          getDecorations={getDecorations ?? ((node) => <ExternalSourcesTreeIcon node={node} />)}
        />
      )}
    />
  );
}

const getDefinitionsProvider = (props: Props<TreeProps["getHierarchyDefinition"]> & { componentId: GuidString }) => {
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
