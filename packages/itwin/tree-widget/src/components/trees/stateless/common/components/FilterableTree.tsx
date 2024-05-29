/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { useCallback, useEffect, useState } from "react";
import { Flex, ProgressRadial, Text } from "@itwin/itwinui-react";
import { createECSchemaProvider, createECSqlQueryExecutor } from "@itwin/presentation-core-interop";
import { createLimitingECSqlQueryExecutor } from "@itwin/presentation-hierarchies";
import { isPresentationHierarchyNode, TreeRenderer, useUnifiedSelectionTree } from "@itwin/presentation-hierarchies-react";
import { createCachingECClassHierarchyInspector } from "@itwin/presentation-shared";
import { useHierarchyLevelFiltering } from "../UseHierarchyFiltering";
import { Delayed } from "./Delayed";
import { ProgressOverlay } from "./ProgressOverlay";

import type { UsageTrackedFeatures } from "../../../common/UseFeatureReporting";
import type { ReactElement, ReactNode } from "react";
import type { IModelConnection } from "@itwin/core-frontend";
import type { SchemaContext } from "@itwin/ecschema-metadata";
import type { PresentationHierarchyNode, useSelectionHandler, useTree } from "@itwin/presentation-hierarchies-react";

interface FilterableTreeOwnProps {
  imodel: IModelConnection;
  getSchemaContext: (imodel: IModelConnection) => SchemaContext;
  height: number;
  width: number;
  treeName: string;
  hierarchyLevelSizeLimit?: number;
  getIcon?: (node: PresentationHierarchyNode) => ReactElement | undefined;
  getSublabel?: (node: PresentationHierarchyNode) => ReactElement | undefined;
  density?: "default" | "enlarged";
  noDataMessage?: ReactNode;
  reportUsage?: (props: { featureId?: UsageTrackedFeatures; reportInteraction: true }) => void;
}

type UseTreeProps = Parameters<typeof useTree>[0];
type UseSelectionHandlerProps = Parameters<typeof useSelectionHandler>[0];
type SelectNodesCallback = UseSelectionHandlerProps["selectNodes"];
type IModelAccess = UseTreeProps["imodelAccess"];

type FilterableTreeProps = FilterableTreeOwnProps &
  Pick<UseTreeProps, "getFilteredPaths" | "getHierarchyDefinition" | "onPerformanceMeasured"> &
  Pick<Partial<UseSelectionHandlerProps>, "selectionMode">;

/** @internal */
export function FilterableTree({ imodel, getSchemaContext, hierarchyLevelSizeLimit, ...props }: FilterableTreeProps) {
  const [imodelAccess, setIModelAccess] = useState<IModelAccess>();
  const defaultHierarchyLevelSizeLimit = hierarchyLevelSizeLimit ?? 1000;

  useEffect(() => {
    const schemas = getSchemaContext(imodel);
    const schemaProvider = createECSchemaProvider(schemas);
    setIModelAccess({
      ...schemaProvider,
      ...createCachingECClassHierarchyInspector({ schemaProvider }),
      ...createLimitingECSqlQueryExecutor(createECSqlQueryExecutor(imodel), 1000),
    });
  }, [imodel, getSchemaContext]);

  if (!imodelAccess) {
    return null;
  }

  return <FilterableTreeRenderer {...props} imodel={imodel} imodelAccess={imodelAccess} defaultHierarchyLevelSizeLimit={defaultHierarchyLevelSizeLimit} />;
}

/** @internal */
function FilterableTreeRenderer({
  imodel,
  imodelAccess,
  height,
  width,
  treeName,
  getIcon,
  getSublabel,
  noDataMessage,
  defaultHierarchyLevelSizeLimit,
  getHierarchyDefinition,
  selectionMode,
  onPerformanceMeasured,
  reportUsage,
}: Omit<FilterableTreeProps, "getSchemaContext"> & { imodelAccess: IModelAccess; defaultHierarchyLevelSizeLimit: number }) {
  const {
    rootNodes,
    isLoading,
    reloadTree: _reloadTree,
    setFormatter: _setFormatter,
    selectNodes,
    expandNode,
    ...treeProps
  } = useUnifiedSelectionTree({
    imodelKey: imodel.key,
    sourceName: treeName,
    imodelAccess,
    getHierarchyDefinition,
    onPerformanceMeasured,
  });
  const reportingSelectNodes = useCallback<SelectNodesCallback>(
    (nodeIds, changeType) => {
      reportUsage?.({ reportInteraction: true });
      return selectNodes(nodeIds, changeType);
    },
    [selectNodes, reportUsage],
  );
  const { filteringDialog, onFilterClick } = useHierarchyLevelFiltering({
    imodel,
    getHierarchyLevelDetails: treeProps.getHierarchyLevelDetails,
    defaultHierarchyLevelSizeLimit,
    reportUsage,
  });

  const renderContent = () => {
    if (rootNodes === undefined) {
      return (
        <Flex alignItems="center" justifyContent="center" flexDirection="column" style={{ width, height }}>
          <Delayed show={true}>
            <ProgressRadial size="large" />
          </Delayed>
        </Flex>
      );
    }

    if ((rootNodes.length === 0 && !isLoading) || (rootNodes.length === 1 && !isPresentationHierarchyNode(rootNodes[0]) && rootNodes[0].type === "Unknown")) {
      return (
        <Flex alignItems="center" justifyContent="center" flexDirection="column" style={{ width, height }}>
          {noDataMessage ? noDataMessage : <Text>The data required for this tree layout is not available in this iModel.</Text>}
        </Flex>
      );
    }

    return (
      <Flex.Item alignSelf="flex-start" style={{ width: "100%", overflow: "auto" }}>
        <TreeRenderer
          rootNodes={rootNodes}
          {...treeProps}
          expandNode={(nodeId, isExpanded) => {
            reportUsage?.({ reportInteraction: true });
            expandNode(nodeId, isExpanded);
          }}
          selectNodes={reportingSelectNodes}
          onFilterClick={(nodeId) => {
            reportUsage?.({ reportInteraction: true });
            onFilterClick(nodeId);
          }}
          getIcon={getIcon}
          getSublabel={getSublabel}
          selectionMode={selectionMode}
        />
      </Flex.Item>
    );
  };

  return (
    <div style={{ position: "relative", height, overflow: "hidden" }}>
      <div style={{ overflow: "auto", height: "100%" }}>
        {renderContent()}
        {filteringDialog}
      </div>
      <Delayed show={isLoading && !!rootNodes}>
        <ProgressOverlay />
      </Delayed>
    </div>
  );
}
