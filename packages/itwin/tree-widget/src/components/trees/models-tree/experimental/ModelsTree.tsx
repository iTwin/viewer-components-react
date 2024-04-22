/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { IModelConnection, Viewport } from "@itwin/core-frontend";
import { SchemaContext } from "@itwin/ecschema-metadata";
import { createECSqlQueryExecutor, createMetadataProvider } from "@itwin/presentation-core-interop";
import { HierarchyNode, HierarchyNodeIdentifiersPath, createLimitingECSqlQueryExecutor } from "@itwin/presentation-hierarchies";
import { ReactElement, useCallback, useEffect, useState } from "react";
import { PresentationHierarchyNode } from "@itwin/presentation-hierarchies-react";
import { ModelsTreeDefinition } from "@itwin/presentation-models-tree";
import { SvgFolder, SvgImodelHollow, SvgItem, SvgLayers, SvgModel } from "@itwin/itwinui-icons-react";
import { ECSchemaRpcLocater } from "@itwin/ecschema-rpcinterface-common";
import { ExperimentalModelsVisibilityHandler } from "./ModelsVisibilityHandlerNew";
import { VisibilityTree } from "./common/VisibilityTree";
import { GetFilteredPathsProps, MetadataAccess } from "./common/UseHierarchyProvider";

export function ExperimentalModelsTree({
  imodel,
  height,
  width,
  activeView,
  filter,
}: {
  imodel: IModelConnection;
  height: number;
  width: number;
  activeView: Viewport;
  filter: string;
}) {
  const [metadata, setMetadata] = useState<MetadataAccess>();
  useEffect(() => {
    const schemas = new SchemaContext();
    schemas.addLocater(new ECSchemaRpcLocater(imodel.getRpcProps()));
    setMetadata({
      queryExecutor: createLimitingECSqlQueryExecutor(createECSqlQueryExecutor(imodel), 1000),
      metadataProvider: createMetadataProvider(schemas),
    });
  }, [imodel]);

  const visibilityHandlerFactory = useCallback(() => {
    const visibilityHandler = new ExperimentalModelsVisibilityHandler({ viewport: activeView });
    return {
      getVisibilityStatus: async (node: HierarchyNode) => visibilityHandler.getVisibilityStatus(node),
      changeVisibility: async (node: HierarchyNode, on: boolean) => visibilityHandler.changeVisibility(node, on),
      onVisibilityChange: visibilityHandler.onVisibilityChange,
      dispose: () => visibilityHandler.dispose(),
    };
  }, [activeView]);

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
      getIcon={getIcon}
    />
  );
}

function createDefinitionsProvider({ metadataProvider }: MetadataAccess) {
  return new ModelsTreeDefinition({ metadataProvider });
}

function getFilteredNodePaths({ metadataProvider, queryExecutor, filter }: GetFilteredPathsProps): Promise<HierarchyNodeIdentifiersPath[]> {
  return ModelsTreeDefinition.createInstanceKeyPaths({ metadataProvider, queryExecutor, label: filter });
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
