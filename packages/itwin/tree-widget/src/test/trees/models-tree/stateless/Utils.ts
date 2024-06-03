/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { IModelConnection } from "@itwin/core-frontend";
import { SchemaContext } from "@itwin/ecschema-metadata";
import { ECSchemaRpcLocater } from "@itwin/ecschema-rpcinterface-common";
import { createECSchemaProvider, createECSqlQueryExecutor } from "@itwin/presentation-core-interop";
import { createHierarchyProvider, createLimitingECSqlQueryExecutor, HierarchyNodeIdentifiersPath } from "@itwin/presentation-hierarchies";
import { createCachingECClassHierarchyInspector } from "@itwin/presentation-shared";
import { ModelsTreeDefinition } from "../../../../components/trees/stateless/models-tree/ModelsTreeDefinition";
import { SubjectModelIdsCache } from "../../../../components/trees/stateless/models-tree/SubjectModelIdsCache";

export function createIModelAccess(imodel: IModelConnection) {
  const schemas = new SchemaContext();
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
  const subjectModelIdsCache = new SubjectModelIdsCache(imodelAccess);
  return createHierarchyProvider({
    imodelAccess,
    hierarchyDefinition: new ModelsTreeDefinition({ imodelAccess, subjectModelIdsCache }),
    ...(filteredNodePaths ? { filtering: { paths: filteredNodePaths } } : undefined),
  });
}
