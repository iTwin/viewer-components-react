/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { IModelConnection } from "@itwin/core-frontend";
import { UseHierarchyProviderProps, useHierarchyProvider } from "./UseHierarchyProvider";
import { UseNodesVisibilityProps, useHierarchyVisibility } from "./UseHierarchyVisibility";
import { useHierarchyFiltering } from "./UseHierarchyFiltering";
import { PresentationHierarchyNode, useTree } from "@itwin/presentation-hierarchies-react";
import { Flex, ProgressRadial } from "@itwin/itwinui-react";
import { VisibilityTreeRenderer } from "./VisibilityTreeRenderer";
import { ReactElement } from "react";

interface BaseProps {
  imodel: IModelConnection;
  height: number;
  width: number;
  filter: string;
  getIcon?: (node: PresentationHierarchyNode) => ReactElement | undefined;
}

type Props = BaseProps & UseHierarchyProviderProps & UseNodesVisibilityProps;

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
}: Props) {
  const { hierarchyProvider, isFiltering } = useHierarchyProvider({
    queryExecutor,
    metadataProvider,
    filter,
    getHierarchyDefinitionsProvider,
    getFilteredPaths,
  });

  const { rootNodes, getHierarchyLevelFilteringOptions, isLoading, ...treeProps } = useTree({ hierarchyProvider });

  const nodesVisibility = useHierarchyVisibility({ visibilityHandlerFactory });
  const { filteringDialog, onFilterClick } = useHierarchyFiltering({
    imodel,
    hierarchyProvider,
    getHierarchyLevelFilteringOptions,
    setHierarchyLevelFilter: treeProps.setHierarchyLevelFilter,
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
        <VisibilityTreeRenderer rootNodes={rootNodes} {...treeProps} {...nodesVisibility} onFilterClick={onFilterClick} getIcon={getIcon} />
        {filteringDialog}
      </div>
    );
  };

  return renderContent();
}
