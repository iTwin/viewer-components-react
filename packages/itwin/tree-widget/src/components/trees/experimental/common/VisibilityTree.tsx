/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { IModelConnection } from "@itwin/core-frontend";
import { useHierarchyProvider } from "./UseHierarchyProvider";
import { useHierarchyVisibility } from "./UseHierarchyVisibility";
import { useHierarchyFiltering } from "./UseHierarchyFiltering";
import { PresentationHierarchyNode, useTree } from "@itwin/presentation-hierarchies-react";
import { Flex, ProgressRadial } from "@itwin/itwinui-react";
import { VisibilityTreeRenderer } from "./VisibilityTreeRenderer";
import { ReactElement } from "react";

interface VisibilityTreeOwnProps {
  imodel: IModelConnection;
  height: number;
  width: number;
  filter: string;
  defaultHierarchyLevelSizeLimit: number;
  getIcon?: (node: PresentationHierarchyNode) => ReactElement | undefined;
  density?: "default" | "enlarged";
}

type UseHierarchyProviderProps = Parameters<typeof useHierarchyProvider>[0];
type UseNodesVisibilityProps = Parameters<typeof useHierarchyVisibility>[0];

type VisibilityTreeProps = VisibilityTreeOwnProps & UseHierarchyProviderProps & UseNodesVisibilityProps;

/** @internal */
export function VisibilityTree({
  imodel,
  height,
  width,
  queryExecutor,
  metadataProvider,
  getIcon,
  getFilteredPaths,
  getHierarchyDefinitionsProvider,
  visibilityHandlerFactory,
  filter,
  defaultHierarchyLevelSizeLimit,
  density,
}: VisibilityTreeProps) {
  const { hierarchyProvider, isFiltering } = useHierarchyProvider({
    queryExecutor,
    metadataProvider,
    filter,
    getHierarchyDefinitionsProvider,
    getFilteredPaths,
  });

  const { rootNodes, getHierarchyLevelConfiguration, isLoading, reloadTree, ...treeProps } = useTree({ hierarchyProvider });

  const nodesVisibility = useHierarchyVisibility({ visibilityHandlerFactory });
  const { filteringDialog, onFilterClick } = useHierarchyFiltering({
    imodel,
    hierarchyProvider,
    getHierarchyLevelConfiguration,
    setHierarchyLevelFilter: treeProps.setHierarchyLevelFilter,
    defaultHierarchyLevelSizeLimit,
  });

  const renderContent = () => {
    if (rootNodes === undefined || isLoading || isFiltering) {
      return (
        <Flex alignItems="center" justifyContent="center" flexDirection="column" style={{ width, height }}>
          <ProgressRadial size="large" />
        </Flex>
      );
    }

    return (
      <div style={{ height, overflow: "auto" }}>
        <VisibilityTreeRenderer
          rootNodes={rootNodes}
          {...treeProps}
          {...nodesVisibility}
          onFilterClick={onFilterClick}
          getIcon={getIcon}
          size={density === "enlarged" ? "default" : "small"}
        />
        {filteringDialog}
      </div>
    );
  };

  return renderContent();
}
