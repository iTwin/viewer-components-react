/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { IModelConnection, Viewport } from "@itwin/core-frontend";
import { SchemaContext } from "@itwin/ecschema-metadata";
import { createECSqlQueryExecutor, createMetadataProvider } from "@itwin/presentation-core-interop";
import {
  HierarchyNode,
  HierarchyNodeIdentifiersPath,
  IHierarchyLevelDefinitionsFactory,
  createLimitingECSqlQueryExecutor,
} from "@itwin/presentation-hierarchies";
import { ReactElement, useCallback, useEffect, useMemo, useState } from "react";
import { PresentationHierarchyNode } from "@itwin/presentation-hierarchies-react";
import { SvgFolder, SvgImodelHollow, SvgItem, SvgLayers, SvgModel } from "@itwin/itwinui-icons-react";
import { ExperimentalModelsVisibilityHandler } from "./ModelsVisibilityHandler";
import { VisibilityTree } from "../common/VisibilityTree";
import { GetFilteredPathsProps, MetadataAccess } from "../common/UseHierarchyProvider";
import { createCachingECClassHierarchyInspector } from "@itwin/presentation-shared";
import { HierarchyLevelConfig } from "../../common/Types";
import { ModelsTreeDefinition } from "./ModelsTreeDefinition";

interface ExperimentalModelsTreeProps {
  imodel: IModelConnection;
  height: number;
  width: number;
  activeView: Viewport;
  getSchemaContext: (imodel: IModelConnection) => SchemaContext;
  filter: string;
  density?: "default" | "enlarged";
  hierarchyLevelConfig?: HierarchyLevelConfig;
}

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
}: ExperimentalModelsTreeProps) {
  const [metadata, setMetadata] = useState<MetadataAccess>();
  const hierarchyLevelSizeLimit = hierarchyLevelConfig?.sizeLimit ?? 1000;

  useEffect(() => {
    setMetadata({
      queryExecutor: createLimitingECSqlQueryExecutor(createECSqlQueryExecutor(imodel), hierarchyLevelSizeLimit),
      metadataProvider: createMetadataProvider(getSchemaContext(imodel)),
    });
  }, [imodel, getSchemaContext, hierarchyLevelSizeLimit]);

  const visibilityHandlerFactory = useCallback(() => {
    const visibilityHandler = new ExperimentalModelsVisibilityHandler({ viewport: activeView });
    return {
      getVisibilityStatus: async (node: HierarchyNode) => visibilityHandler.getVisibilityStatus(node),
      changeVisibility: async (node: HierarchyNode, on: boolean) => visibilityHandler.changeVisibility(node, on),
      onVisibilityChange: visibilityHandler.onVisibilityChange,
      dispose: () => visibilityHandler.dispose(),
    };
  }, [activeView]);

  const createDefinitionsProvider = useMemo(
    () => createDefinitionsProviderFactory(hierarchyLevelConfig?.isFilteringEnabled),
    [hierarchyLevelConfig?.isFilteringEnabled],
  );

  if (!metadata) {
    return null;
  }

  return (
    <VisibilityTree
      metadataProvider={metadata.metadataProvider}
      queryExecutor={metadata.queryExecutor}
      filter={filter}
      height={height}
      width={width}
      imodel={imodel}
      visibilityHandlerFactory={visibilityHandlerFactory}
      getHierarchyDefinitionsProvider={createDefinitionsProvider}
      getFilteredPaths={getFilteredNodePaths}
      defaultHierarchyLevelSizeLimit={hierarchyLevelSizeLimit}
      getIcon={getIcon}
      density={density}
    />
  );
}

function createDefinitionsProviderFactory(enableHierarchyFiltering?: boolean) {
  return ({ metadataProvider }: MetadataAccess): IHierarchyLevelDefinitionsFactory => {
    const modelsTreeDefinition = new ModelsTreeDefinition({ metadataProvider });
    return {
      defineHierarchyLevel: (props) => modelsTreeDefinition.defineHierarchyLevel(props),
      postProcessNode: async (node) => {
        const defaultNode = await modelsTreeDefinition.postProcessNode(node);
        if (!HierarchyNode.isGroupingNode(defaultNode) && defaultNode.supportsFiltering && !enableHierarchyFiltering) {
          return {
            ...defaultNode,
            supportsFiltering: false,
          };
        }
        return defaultNode;
      },
    };
  };
}

function getFilteredNodePaths({ metadataProvider, queryExecutor, filter }: GetFilteredPathsProps): Promise<HierarchyNodeIdentifiersPath[]> {
  return ModelsTreeDefinition.createInstanceKeyPaths({
    classHierarchyInspector: createCachingECClassHierarchyInspector({ metadataProvider }),
    queryExecutor,
    label: filter,
  });
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
