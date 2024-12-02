/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { useState } from "react";
import { Flex, ProgressRadial, Text } from "@itwin/itwinui-react";
import { TreeRenderer, UnifiedSelectionProvider, useUnifiedSelectionTree } from "@itwin/presentation-hierarchies-react";
import { TreeWidget } from "../../../TreeWidget";
import { Delayed } from "../common/components/Delayed";
import { ProgressOverlay } from "../common/components/ProgressOverlay";
import { getRepositoryNodeIcon } from "./GetIcon";
import { UseRepositoriesHierarchyProvider } from "./UseRepositoriesHierarchyProvider";

import type { SelectionStorage } from "@itwin/presentation-hierarchies-react";

interface RepositoriesTreeProps {
  selectionStorage: SelectionStorage;
  accessToken: string;
  itwinId: string;
  environment?: "PROD" | "QA" | "DEV";
  noDataMessage?: string;
}

/**
 * @alpha
 */
export function RepositoriesTree({ selectionStorage, ...props }: RepositoriesTreeProps) {
  return (
    <UnifiedSelectionProvider storage={selectionStorage}>
      <Tree {...props} />
    </UnifiedSelectionProvider>
  );
}

function Tree({ accessToken, itwinId, noDataMessage, environment }: Omit<RepositoriesTreeProps, "selectionStorage">) {
  const [isLoading, setIsLoading] = useState(true);
  const getHierarchyProvider = UseRepositoriesHierarchyProvider({ accessToken, itwinId, setIsLoading, environment });

  const { rootNodes, ...treeProps } = useUnifiedSelectionTree({
    sourceName: "RepositoriesTree",
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
