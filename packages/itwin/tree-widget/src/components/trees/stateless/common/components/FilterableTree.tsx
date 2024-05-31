/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import "./FilterableTree.scss";
import { useEffect, useState } from "react";
import { Flex, ProgressRadial, Text } from "@itwin/itwinui-react";
import { createECSchemaProvider, createECSqlQueryExecutor } from "@itwin/presentation-core-interop";
import { createLimitingECSqlQueryExecutor } from "@itwin/presentation-hierarchies";
import { isPresentationHierarchyNode, TreeRenderer, useUnifiedSelectionTree } from "@itwin/presentation-hierarchies-react";
import { createCachingECClassHierarchyInspector } from "@itwin/presentation-shared";
import { TreeWidget } from "../../../../../TreeWidget";
import { useReportingAction } from "../../../common/UseFeatureReporting";
import { useHierarchiesLocalization } from "../UseHierarchiesLocalization";
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
  reportUsage?: (props: { featureId?: UsageTrackedFeatures; reportInteraction: boolean }) => void;
}

type UseTreeProps = Parameters<typeof useTree>[0];
type UseSelectionHandlerProps = Parameters<typeof useSelectionHandler>[0];
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
  const localizedStrings = useHierarchiesLocalization();
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
    localizedStrings,
    getHierarchyDefinition,
    onPerformanceMeasured,
    onHierarchyLimitExceeded: () => reportUsage?.({ featureId: "hierarchy-level-size-limit-hit", reportInteraction: false }),
  });
  const { filteringDialog, onFilterClick } = useHierarchyLevelFiltering({
    imodel,
    getHierarchyLevelDetails: treeProps.getHierarchyLevelDetails,
    defaultHierarchyLevelSizeLimit,
    reportUsage,
  });
  const reportingExpandNode = useReportingAction({ action: expandNode, reportUsage });
  const reportingSelectNodes = useReportingAction({ action: selectNodes, reportUsage });
  const reportingOnFilterClicked = useReportingAction({ action: onFilterClick, reportUsage });

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
        {noDataMessage ? noDataMessage : <Text>{TreeWidget.translate("stateless.dataIsNotAvailable")}</Text>}
      </Flex>
    );
  }

  return (
    <div style={{ position: "relative", height, overflow: "hidden" }}>
      <div style={{ overflow: "auto", height: "100%" }}>
        <TreeRenderer
          className="tw-filterable-tree-renderer"
          rootNodes={rootNodes}
          {...treeProps}
          expandNode={reportingExpandNode}
          selectNodes={reportingSelectNodes}
          onFilterClick={reportingOnFilterClicked}
          getIcon={getIcon}
          getSublabel={getSublabel}
          selectionMode={selectionMode}
          localizedStrings={localizedStrings}
        />
        {filteringDialog}
      </div>
      <Delayed show={isLoading}>
        <ProgressOverlay />
      </Delayed>
    </div>
  );
}
