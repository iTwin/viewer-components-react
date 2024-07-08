/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { SvgDetails, SvgDocument, SvgItem } from "@itwin/itwinui-icons-react";
import { Tree } from "../common/components/Tree";
import { TreeRenderer } from "../common/components/TreeRenderer";
import { ExternalSourcesTreeComponent } from "./ExternalSourcesTreeComponent";
import { ExternalSourcesTreeDefinition } from "./ExternalSourcesTreeDefinition";

import type { ReactElement } from "react";
import type { PresentationHierarchyNode } from "@itwin/presentation-hierarchies-react";

/** @beta */
interface ExternalSourcesTreeOwnProps {
  hierarchyLevelConfig?: {
    sizeLimit?: number;
  };
}

/** @beta */
type TreeProps = Parameters<typeof Tree>[0];

/** @beta */
type ExternalSourcesTreeProps = ExternalSourcesTreeOwnProps &
  Pick<TreeProps, "imodel" | "getSchemaContext" | "selectionStorage" | "height" | "width" | "density" | "selectionMode">;

/** @beta */
export function ExternalSourcesTree(props: ExternalSourcesTreeProps) {
  return (
    <Tree
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

function getIcon(node: PresentationHierarchyNode): ReactElement | undefined {
  if (node.extendedData?.imageId === undefined) {
    return undefined;
  }

  switch (node.extendedData.imageId) {
    case "icon-item":
      return <SvgItem />;
    case "icon-ec-class":
      return <SvgItem />;
    case "icon-document":
      return <SvgDocument />;
    case "icon-ec-schema":
      return <SvgDetails />;
  }

  return undefined;
}
