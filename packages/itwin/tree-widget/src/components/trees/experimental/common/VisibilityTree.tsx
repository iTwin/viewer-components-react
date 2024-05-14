/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { IModelConnection } from "@itwin/core-frontend";
import { useHierarchyVisibility } from "./UseHierarchyVisibility";
import { useHierarchyFiltering } from "./UseHierarchyFiltering";
import { PresentationHierarchyNode, useTree, useUnifiedSelectionTree } from "@itwin/presentation-hierarchies-react";
import { Flex, ProgressLinear, ProgressRadial, Text } from "@itwin/itwinui-react";
import { VisibilityTreeRenderer } from "./VisibilityTreeRenderer";
import { PropsWithChildren, ReactElement, ReactNode, useEffect, useLayoutEffect, useState } from "react";
import { SchemaContext } from "@itwin/ecschema-metadata";
import { createECSchemaProvider, createECSqlQueryExecutor } from "@itwin/presentation-core-interop";
import { createLimitingECSqlQueryExecutor } from "@itwin/presentation-hierarchies";
import { createCachingECClassHierarchyInspector } from "@itwin/presentation-shared";

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

type VisibilityTreeProps = VisibilityTreeOwnProps & Pick<UseTreeProps, "getFilteredPaths" | "getHierarchyDefinitionsProvider"> & UseNodesVisibilityProps;

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
  getHierarchyDefinitionsProvider,
  getFilteredPaths,
  visibilityHandlerFactory,
  defaultHierarchyLevelSizeLimit,
  noDataMessage,
  getIcon,
  density,
}: Omit<VisibilityTreeProps, "getSchemaContext" | "hierarchyLevelSizeLimit"> & { imodelAccess: IModelAccess; defaultHierarchyLevelSizeLimit: number }) {
  const { rootNodes, hierarchyProvider, getHierarchyLevelConfiguration, isLoading, reloadTree, ...treeProps } = useUnifiedSelectionTree({
    imodelAccess,
    getHierarchyDefinitionsProvider,
    getFilteredPaths,
    imodelKey: imodel.key,
    sourceName: "ExperimentalModelsTree",
  });

  const nodesVisibility = useHierarchyVisibility({ visibilityHandlerFactory });
  const { filteringDialog, onFilterClick } = useHierarchyFiltering({
    imodel,
    hierarchyProvider,
    getHierarchyLevelConfiguration,
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
          {...nodesVisibility}
          onFilterClick={onFilterClick}
          getIcon={getIcon}
          size={density === "enlarged" ? "default" : "small"}
        />
        {filteringDialog}
      </div>
      <Delayed show={isLoading}>
        <FilteringOverlay />
      </Delayed>
    </div>
  );
}

function Delayed({ show, children }: PropsWithChildren<{ show: boolean }>) {
  const [visible, setVisible] = useState(false);

  useLayoutEffect(() => {
    if (!show) {
      setVisible(false);
      return;
    }

    const timer = setTimeout(() => {
      setVisible(show);
    }, 250);
    return () => {
      clearTimeout(timer);
    };
  }, [show]);

  if (!visible) {
    return null;
  }

  return <>{children}</>;
}

function FilteringOverlay() {
  return (
    <div
      style={{
        position: "absolute",
        left: 0,
        top: 0,
        zIndex: 1000,
        height: "100%",
        width: "100%",
        overflow: "hidden",
      }}
    >
      <ProgressLinear indeterminate />
      <div
        style={{
          opacity: 0.5,
          backgroundColor: "var(--iui-color-background-backdrop)",
          height: "100%",
          width: "100%",
        }}
      />
    </div>
  );
}
