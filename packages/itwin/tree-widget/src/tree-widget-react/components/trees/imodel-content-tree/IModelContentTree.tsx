/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { useCallback, useMemo } from "react";
import { Guid } from "@itwin/core-bentley";
import { SvgFolder, SvgGroup, SvgHierarchyTree, SvgImodelHollow, SvgItem, SvgLayers, SvgModel } from "@itwin/itwinui-icons-react";
import { Tree } from "../common/components/Tree.js";
import { TreeRenderer } from "../common/components/TreeRenderer.js";
import { IModelContentTreeComponent } from "./IModelContentTreeComponent.js";
import { defaultHierarchyConfiguration, IModelContentTreeDefinition } from "./IModelContentTreeDefinition.js";
import { IModelContentTreeIdsCache } from "./internal/IModelContentTreeIdsCache.js";

import type { ReactElement } from "react";
import type { GuidString } from "@itwin/core-bentley";
import type { PresentationHierarchyNode } from "@itwin/presentation-hierarchies-react";
import type { TreeProps } from "../common/components/Tree.js";
import type { IModelContentTreeHierarchyConfiguration } from "./IModelContentTreeDefinition.js";

/** @beta */
export type IModelContentTreeProps = Pick<TreeProps, "imodel" | "getSchemaContext" | "selectionStorage" | "density" | "selectionMode"> & {
  hierarchyLevelConfig?: {
    sizeLimit?: number;
  };
  hierarchyConfig?: Partial<IModelContentTreeHierarchyConfiguration>;
};

/** @beta */
export function IModelContentTree({ hierarchyConfig: hierarchyConfigProp, ...props }: IModelContentTreeProps) {
  const componentId: GuidString = useMemo(() => Guid.createValue(), []);
  const getHierarchyDefinition = useCallback<TreeProps["getHierarchyDefinition"]>(
    ({ imodelAccess }) => {
      const hierarchyConfig = {
        ...defaultHierarchyConfiguration,
        ...hierarchyConfigProp,
      };
      return new IModelContentTreeDefinition({ imodelAccess, idsCache: new IModelContentTreeIdsCache(imodelAccess, componentId), hierarchyConfig });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    Object.values(hierarchyConfigProp ?? {}),
  );

  return (
    <Tree
      {...props}
      treeName={IModelContentTreeComponent.id}
      getHierarchyDefinition={getHierarchyDefinition}
      selectionMode={props.selectionMode ?? "extended"}
      treeRenderer={(treeProps) => <TreeRenderer {...treeProps} getIcon={getIcon} />}
    />
  );
}

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
