/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { ReactElement, ReactNode, useEffect, useState } from "react";
import { IModelConnection } from "@itwin/core-frontend";
import { PresentationHierarchyNode, useSelectionHandler, useTree, useUnifiedSelectionTree } from "@itwin/presentation-hierarchies-react";
import { Flex, ProgressRadial, Text } from "@itwin/itwinui-react";
import { SchemaContext } from "@itwin/ecschema-metadata";
import { createECSchemaProvider, createECSqlQueryExecutor } from "@itwin/presentation-core-interop";
import { createLimitingECSqlQueryExecutor } from "@itwin/presentation-hierarchies";
import { createCachingECClassHierarchyInspector } from "@itwin/presentation-shared";
import { useMultiCheckboxHandler } from "../UseMultiCheckboxHandler";
import { useHierarchyVisibility } from "../UseHierarchyVisibility";
import { useHierarchyFiltering } from "../UseHierarchyFiltering";
import { VisibilityTreeRenderer } from "./VisibilityTreeRenderer";
import { Delayed } from "./Delayed";
import { ProgressOverlay } from "./ProgressOverlay";

interface VisibilityTreeOwnProps {
  imodel: IModelConnection;
  getSchemaContext: (imodel: IModelConnection) => SchemaContext;
  height: number;
  width: number;
  hierarchyLevelSizeLimit?: number;
  getIcon?: (node: PresentationHierarchyNode) => ReactElement | undefined;
  density?: "default" | "enlarged";
  noDataMessage?: ReactNode;
}

type UseTreeProps = Parameters<typeof useTree>[0];
type UseNodesVisibilityProps = Parameters<typeof useHierarchyVisibility>[0];
type IModelAccess = UseTreeProps["imodelAccess"];
type UseSelectionHandlerProps = Parameters<typeof useSelectionHandler>[0];

type VisibilityTreeProps = VisibilityTreeOwnProps &
  Pick<UseTreeProps, "getFilteredPaths" | "getHierarchyDefinition"> &
  UseNodesVisibilityProps &
  Pick<Partial<UseSelectionHandlerProps>, "selectionMode">;

/** @internal */
export function VisibilityTree({ imodel, getSchemaContext, hierarchyLevelSizeLimit, ...props }: VisibilityTreeProps) {
  const [imodelAccess, setImodelAccess] = useState<IModelAccess>();
  const defaultHierarchyLevelSizeLimit = hierarchyLevelSizeLimit ?? 1000;

  useEffect(() => {
    const schemaProvider = createECSchemaProvider(getSchemaContext(imodel));
    setImodelAccess({
      ...createLimitingECSqlQueryExecutor(createECSqlQueryExecutor(imodel), defaultHierarchyLevelSizeLimit),
      ...schemaProvider,
      ...createCachingECClassHierarchyInspector({ schemaProvider }),
    });
  }, [imodel, getSchemaContext, defaultHierarchyLevelSizeLimit]);

  if (!imodelAccess) {
    return null;
  }

  return <VisibilityTreeImpl {...props} imodel={imodel} imodelAccess={imodelAccess} defaultHierarchyLevelSizeLimit={defaultHierarchyLevelSizeLimit} />;
}

function VisibilityTreeImpl({
  height,
  width,
  imodel,
  imodelAccess,
  getHierarchyDefinition,
  getFilteredPaths,
  visibilityHandlerFactory,
  defaultHierarchyLevelSizeLimit,
  noDataMessage,
  getIcon,
  density,
  selectionMode,
}: Omit<VisibilityTreeProps, "getSchemaContext" | "hierarchyLevelSizeLimit"> & { imodelAccess: IModelAccess; defaultHierarchyLevelSizeLimit: number }) {
  const {
    rootNodes,
    getHierarchyLevelDetails,
    isLoading,
    reloadTree,
    selectNodes,
    setFormatter: _,
    ...treeProps
  } = useUnifiedSelectionTree({
    imodelAccess,
    getHierarchyDefinition,
    getFilteredPaths,
    imodelKey: imodel.key,
    sourceName: "ExperimentalModelsTree",
  });
  const { onNodeClick, onNodeKeyDown } = useSelectionHandler({ rootNodes, selectNodes, selectionMode: selectionMode ?? "single" });
  const { getCheckboxStatus, onCheckboxClicked: onClick } = useHierarchyVisibility({ visibilityHandlerFactory });
  const { onCheckboxClicked } = useMultiCheckboxHandler({ rootNodes, isNodeSelected: treeProps.isNodeSelected, onClick });
  const { filteringDialog, onFilterClick } = useHierarchyFiltering({
    imodel,
    getHierarchyLevelDetails,
    setHierarchyLevelFilter: treeProps.setHierarchyLevelFilter,
    defaultHierarchyLevelSizeLimit,
  });

  if (rootNodes === undefined) {
    return (
      <Flex alignItems="center" justifyContent="center" flexDirection="column" style={{ width, height }}>
        <Delayed show={true}>
          <ProgressRadial size="large" />
        </Delayed>
      </Flex>
    );
  }

  if (rootNodes.length === 0 && !isLoading) {
    return (
      <Flex alignItems="center" justifyContent="center" flexDirection="column" style={{ width, height }}>
        {noDataMessage ? noDataMessage : <Text>The data required for this tree layout is not available in this iModel.</Text>}
      </Flex>
    );
  }

  return (
    <div style={{ position: "relative", height, overflow: "hidden" }}>
      <div style={{ overflow: "auto", height: "100%" }}>
        <VisibilityTreeRenderer
          rootNodes={rootNodes}
          {...treeProps}
          onNodeClick={onNodeClick}
          onNodeKeyDown={onNodeKeyDown}
          getCheckboxStatus={getCheckboxStatus}
          onCheckboxClicked={onCheckboxClicked}
          onFilterClick={onFilterClick}
          getIcon={getIcon}
          size={density === "enlarged" ? "default" : "small"}
        />
        {filteringDialog}
      </div>
      <Delayed show={isLoading}>
        <ProgressOverlay />
      </Delayed>
    </div>
  );
}
