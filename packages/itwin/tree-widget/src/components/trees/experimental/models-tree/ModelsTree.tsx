/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { IModelConnection, Viewport } from "@itwin/core-frontend";
import { SchemaContext } from "@itwin/ecschema-metadata";
import { createECSqlQueryExecutor, createECSchemaProvider } from "@itwin/presentation-core-interop";
import { HierarchyNode, IHierarchyLevelDefinitionsFactory, createLimitingECSqlQueryExecutor } from "@itwin/presentation-hierarchies";
import { ComponentPropsWithoutRef, ReactElement, useCallback, useEffect, useMemo, useState } from "react";
import { PresentationHierarchyNode } from "@itwin/presentation-hierarchies-react";
import { SvgFolder, SvgImodelHollow, SvgItem, SvgLayers, SvgModel } from "@itwin/itwinui-icons-react";
import { ExperimentalModelsVisibilityHandler } from "./ModelsVisibilityHandler";
import { VisibilityTree } from "../common/VisibilityTree";
import { InstanceKey, createCachingECClassHierarchyInspector } from "@itwin/presentation-shared";
import { HierarchyLevelConfig } from "../../common/Types";
import { ModelsTreeDefinition } from "./ModelsTreeDefinition";
import { Text } from "@itwin/itwinui-react";

interface ExperimentalModelsTreeProps {
  imodel: IModelConnection;
  height: number;
  width: number;
  activeView: Viewport;
  getSchemaContext: (imodel: IModelConnection) => SchemaContext;
  filter: string;
  density?: "default" | "enlarged";
  hierarchyLevelConfig?: Omit<HierarchyLevelConfig, "isFilteringEnabled">;
  focusedInstanceKeys?: InstanceKey[];
}

type VisibilityTreeProps = ComponentPropsWithoutRef<typeof VisibilityTree>;
type GetFilteredPathsCallback = VisibilityTreeProps["getFilteredPaths"];
type GetHierarchyDefinitionsProviderCallback = VisibilityTreeProps["getHierarchyDefinitionsProvider"];

/** @internal */
export function ExperimentalModelsTree({
  imodel,
  getSchemaContext,
  height,
  width,
  activeView,
  filter,
  density,
  hierarchyLevelConfig,
  focusedInstanceKeys,
}: ExperimentalModelsTreeProps) {
  const visibilityHandlerFactory = useCallback(() => {
    const visibilityHandler = new ExperimentalModelsVisibilityHandler({ viewport: activeView });
    return {
      getVisibilityStatus: async (node: HierarchyNode) => visibilityHandler.getVisibilityStatus(node),
      changeVisibility: async (node: HierarchyNode, on: boolean) => visibilityHandler.changeVisibility(node, on),
      onVisibilityChange: visibilityHandler.onVisibilityChange,
      dispose: () => visibilityHandler.dispose(),
    };
  }, [activeView]);

  const getFocusedFilteredPaths = useMemo<GetFilteredPathsCallback | undefined>(() => {
    if (!focusedInstanceKeys) {
      return undefined;
    }
    return async ({ imodelAccess }) => ModelsTreeDefinition.createInstanceKeyPaths({ imodelAccess, keys: focusedInstanceKeys });
  }, [focusedInstanceKeys]);

  const getSearchFilteredPaths = useMemo<GetFilteredPathsCallback | undefined>(() => {
    if (!filter) {
      return undefined;
    }
    return async ({ imodelAccess }) => ModelsTreeDefinition.createInstanceKeyPaths({ imodelAccess, label: filter });
  }, [filter]);

  const getFilteredPaths = getFocusedFilteredPaths ?? getSearchFilteredPaths;

  return (
    <VisibilityTree
      height={height}
      width={width}
      imodel={imodel}
      getSchemaContext={getSchemaContext}
      visibilityHandlerFactory={visibilityHandlerFactory}
      getHierarchyDefinitionsProvider={getDefinitionsProvider}
      getFilteredPaths={getFilteredPaths}
      hierarchyLevelSizeLimit={hierarchyLevelConfig?.sizeLimit}
      getIcon={getIcon}
      density={density}
      noDataMessage={getNoDataMessage(filter)}
    />
  );
}

function getNoDataMessage(filter: string) {
  if (filter) {
    return <Text>There are no nodes matching filter - "{filter}"</Text>;
  }
  return undefined;
}

function getDefinitionsProvider(props: Parameters<GetHierarchyDefinitionsProviderCallback>[0]) {
  return new ModelsTreeDefinition(props);
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
  }

  return undefined;
}
