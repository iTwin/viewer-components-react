/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { ComponentPropsWithoutRef, ReactElement, useCallback, useMemo } from "react";
import { IModelConnection, Viewport } from "@itwin/core-frontend";
import { SchemaContext } from "@itwin/ecschema-metadata";
import { Text } from "@itwin/itwinui-react";
import { SvgFolder, SvgImodelHollow, SvgItem, SvgLayers, SvgModel } from "@itwin/itwinui-icons-react";
import { HierarchyNode } from "@itwin/presentation-hierarchies";
import { PresentationHierarchyNode } from "@itwin/presentation-hierarchies-react";
import { ExperimentalModelsVisibilityHandler } from "./ModelsVisibilityHandler";
import { VisibilityTree } from "../common/components/VisibilityTree";
import { HierarchyLevelConfig } from "../../common/Types";
import { ModelsTreeDefinition } from "./ModelsTreeDefinition";
import { useFocusedInstancesContext } from "../common/FocusedInstancesContext";

interface ExperimentalModelsTreeProps {
  imodel: IModelConnection;
  height: number;
  width: number;
  activeView: Viewport;
  getSchemaContext: (imodel: IModelConnection) => SchemaContext;
  filter: string;
  density?: "default" | "enlarged";
  hierarchyLevelConfig?: Omit<HierarchyLevelConfig, "isFilteringEnabled">;
  selectionMode?: SelectionMode;
}

type VisibilityTreeProps = ComponentPropsWithoutRef<typeof VisibilityTree>;
type GetFilteredPathsCallback = VisibilityTreeProps["getFilteredPaths"];
type GetHierarchyDefinitionCallback = VisibilityTreeProps["getHierarchyDefinition"];
type SelectionMode = VisibilityTreeProps["selectionMode"];

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
  selectionMode,
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
  const { instanceKeys: focusedInstancesKeys } = useFocusedInstancesContext();

  const getFocusedFilteredPaths = useMemo<GetFilteredPathsCallback | undefined>(() => {
    if (!focusedInstancesKeys) {
      return undefined;
    }
    return async ({ imodelAccess }) => {
      try {
        return ModelsTreeDefinition.createInstanceKeyPaths({ imodelAccess, keys: focusedInstancesKeys });
      } catch {
        return undefined;
      }
    };
  }, [focusedInstancesKeys]);

  const getSearchFilteredPaths = useMemo<GetFilteredPathsCallback | undefined>(() => {
    if (!filter) {
      return undefined;
    }
    return async ({ imodelAccess }) => {
      try {
        return ModelsTreeDefinition.createInstanceKeyPaths({ imodelAccess, label: filter });
      } catch {
        return undefined;
      }
    };
  }, [filter]);

  const getFilteredPaths = getFocusedFilteredPaths ?? getSearchFilteredPaths;

  return (
    <VisibilityTree
      height={height}
      width={width}
      imodel={imodel}
      getSchemaContext={getSchemaContext}
      visibilityHandlerFactory={visibilityHandlerFactory}
      getHierarchyDefinition={getHierarchyDefinition}
      getFilteredPaths={getFilteredPaths}
      hierarchyLevelSizeLimit={hierarchyLevelConfig?.sizeLimit}
      getIcon={getIcon}
      density={density}
      noDataMessage={getNoDataMessage(filter)}
      selectionMode={selectionMode}
    />
  );
}

function getNoDataMessage(filter: string) {
  if (filter) {
    return <Text>There are no nodes matching filter - "{filter}"</Text>;
  }
  return undefined;
}

function getHierarchyDefinition(props: Parameters<GetHierarchyDefinitionCallback>[0]) {
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
