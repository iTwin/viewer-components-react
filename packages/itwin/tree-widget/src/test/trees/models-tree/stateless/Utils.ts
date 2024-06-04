/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { SchemaContext } from "@itwin/ecschema-metadata";
import { ECSchemaRpcLocater } from "@itwin/ecschema-rpcinterface-common";
import { createECSchemaProvider, createECSqlQueryExecutor } from "@itwin/presentation-core-interop";
import { createHierarchyProvider, createLimitingECSqlQueryExecutor } from "@itwin/presentation-hierarchies";
import { createCachingECClassHierarchyInspector } from "@itwin/presentation-shared";
import { ModelsTreeIdsCache } from "../../../../components/trees/stateless/models-tree/internal/ModelsTreeIdsCache";
import { ModelsTreeDefinition } from "../../../../components/trees/stateless/models-tree/ModelsTreeDefinition";

import type { IModelConnection } from "@itwin/core-frontend";
import type { HierarchyNodeIdentifiersPath } from "@itwin/presentation-hierarchies";
export function createIModelAccess(imodel: IModelConnection) {
  const schemas = new SchemaContext();
  // eslint-disable-next-line @itwin/no-internal
  schemas.addLocater(new ECSchemaRpcLocater(imodel.getRpcProps()));
  const schemaProvider = createECSchemaProvider(schemas);
  return {
    ...schemaProvider,
    ...createCachingECClassHierarchyInspector({ schemaProvider }),
    ...createLimitingECSqlQueryExecutor(createECSqlQueryExecutor(imodel), 1000),
  };
}

export function createModelsTreeProvider(imodel: IModelConnection, filteredNodePaths?: HierarchyNodeIdentifiersPath[]) {
  const imodelAccess = createIModelAccess(imodel);
  const idsCache = new ModelsTreeIdsCache(imodelAccess);
  return createHierarchyProvider({
    imodelAccess,
    hierarchyDefinition: new ModelsTreeDefinition({ imodelAccess, idsCache }),
    ...(filteredNodePaths ? { filtering: { paths: filteredNodePaths } } : undefined),
  });
}
