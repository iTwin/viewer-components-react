/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { Flex, ProgressRadial, Text } from "@itwin/itwinui-react";
import { TreeRenderer, useTree } from "@itwin/presentation-hierarchies-react";
import { TreeWidget } from "@itwin/tree-widget-react";
import { getRepositoryNodeIcon } from "./GetIcon";
import { useRepositoriesHierarchyProvider } from "./UseRepositoriesHierarchyProvider";
import { Delayed, ProgressOverlay } from "./Utils";

interface RepositoriesTreeProps {
  itwinId: string;
  environment?: "PROD" | "QA" | "DEV";
  noDataMessage?: string;
}

/**
 * @alpha
 */
export function RepositoriesTree({ itwinId, noDataMessage, environment }: RepositoriesTreeProps) {
  const getHierarchyProvider = useRepositoriesHierarchyProvider({ itwinId, environment });

  const { rootNodes, isLoading, ...treeProps } = useTree({
    getHierarchyProvider,
  });

  const treeRenderer = () => {
    if (rootNodes === undefined) {
      return (
        <Flex alignItems="center" justifyContent="center" flexDirection="column" style={{ width: "100%", height: "100%" }}>
          <Delayed show={true}>
            <ProgressRadial size="large" />
          </Delayed>
        </Flex>
      );
    }

    if (rootNodes.length === 0 && !isLoading) {
      return (
        <Flex alignItems="center" justifyContent="center" flexDirection="column" style={{ width: "100%", height: "100%" }}>
          {noDataMessage ? noDataMessage : <Text>{TreeWidget.translate("baseTree.dataIsNotAvailable")}</Text>}
        </Flex>
      );
    }

    return (
      <Flex.Item alignSelf="flex-start" style={{ width: "100%", overflow: "auto" }}>
        <TreeRenderer rootNodes={rootNodes} {...treeProps} selectionMode={"extended"} getIcon={getRepositoryNodeIcon} />
      </Flex.Item>
    );
  };

  return (
    <div style={{ position: "relative", height: "100%", overflow: "hidden" }}>
      <div id="tw-tree-renderer-container" style={{ overflow: "auto", height: "100%" }}>
        {treeRenderer()}
      </div>
      <Delayed show={isLoading}>
        <ProgressOverlay />
      </Delayed>
    </div>
  );
}
