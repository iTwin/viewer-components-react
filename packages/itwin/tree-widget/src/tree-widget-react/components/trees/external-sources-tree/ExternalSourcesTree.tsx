/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { useCallback, useMemo } from "react";
import { Guid } from "@itwin/core-bentley";
import { SvgDetails, SvgDocument, SvgItem } from "@itwin/itwinui-icons-react";
import { Tree } from "../common/components/Tree.js";
import { TreeRenderer } from "../common/components/TreeRenderer.js";
import { ExternalSourcesTreeComponent } from "./ExternalSourcesTreeComponent.js";
import { ExternalSourcesTreeDefinition } from "./ExternalSourcesTreeDefinition.js";

import type { ReactElement } from "react";
import type { GuidString } from "@itwin/core-bentley";
import type { HierarchyDefinition } from "@itwin/presentation-hierarchies";
import type { PresentationHierarchyNode } from "@itwin/presentation-hierarchies-react";
import type { TreeProps } from "../common/components/Tree.js";

/** @beta */
export type ExternalSourcesTreeProps = Pick<TreeProps, "imodel" | "getSchemaContext" | "selectionStorage" | "density" | "selectionMode"> & {
  hierarchyLevelConfig?: {
    sizeLimit?: number;
  };
};

/** @beta */
export function ExternalSourcesTree(props: ExternalSourcesTreeProps) {
  const componentId: GuidString = useMemo(() => Guid.createValue(), []);
  return (
    <Tree
      {...props}
      treeName={ExternalSourcesTreeComponent.id}
      getHierarchyDefinition={useCallback((definitionProps) => getDefinitionsProvider({ ...definitionProps, componentId }), [componentId])}
      selectionMode={props.selectionMode ?? "none"}
      treeRenderer={(treeProps) => <TreeRenderer {...treeProps} getIcon={getIcon} />}
    />
  );
}

const getDefinitionsProvider = (props: Parameters<TreeProps["getHierarchyDefinition"]>[0] & { componentId: GuidString }): HierarchyDefinition => {
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
