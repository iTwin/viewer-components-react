/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/


import { NoDataRenderer } from "../common/components/NoDataRenderer.js";
import { Tree } from "../common/components/Tree.js";
import { TreeRenderer } from "../common/components/TreeRenderer.js";
import { ExternalSourcesTreeComponent } from "./ExternalSourcesTreeComponent.js";
import { ExternalSourcesTreeDefinition } from "./ExternalSourcesTreeDefinition.js";

import type { PresentationHierarchyNode } from "@itwin/presentation-hierarchies-react";
import type { BaseTreeRendererProps } from "../common/components/BaseTreeRenderer.js";
import type { TreeProps } from "../common/components/Tree.js";

/** @beta */
export type ExternalSourcesTreeProps = Pick<TreeProps, "imodel" | "getSchemaContext" | "selectionStorage" | "selectionMode" | "noDataMessage"> &
  Pick<BaseTreeRendererProps, "actions"> & {
    hierarchyLevelConfig?: {
      sizeLimit?: number;
    };
  };

/** @beta */
export function ExternalSourcesTree(props: ExternalSourcesTreeProps) {
  return (
    <Tree
      noDataMessage={<NoDataRenderer icon={documentIcon} />}
      {...props}
      treeName={ExternalSourcesTreeComponent.id}
      getHierarchyDefinition={getDefinitionsProvider}
      selectionMode={props.selectionMode ?? "none"}
      treeRenderer={(treeProps) => <TreeRenderer {...treeProps} getIcon={getIcon} />}
    />
  );
}

const getDefinitionsProvider: TreeProps["getHierarchyDefinition"] = (props) => {
  return new ExternalSourcesTreeDefinition(props);
};

const ecSchemaIcon = new URL("@itwin/itwinui-icons/selection-children.svg", import.meta.url).href;
const elementIcon = new URL("@itwin/itwinui-icons/tree-element.svg", import.meta.url).href;
const documentIcon = new URL("@itwin/itwinui-icons/document-reference.svg", import.meta.url).href;
const classIcon = new URL("@itwin/itwinui-icons/tree-class.svg", import.meta.url).href;

function getIcon(node: PresentationHierarchyNode): string | undefined {
  if (node.extendedData?.imageId === undefined) {
    return undefined;
  }

  switch (node.extendedData.imageId) {
    case "icon-item":
      return elementIcon;
    case "icon-ec-class":
      return classIcon;
    case "icon-document":
      return documentIcon;
    case "icon-ec-schema":
      return ecSchemaIcon;
  }

  return undefined;
}
