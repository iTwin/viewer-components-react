/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { createHierarchyProvider } from "@itwin/presentation-hierarchies";
import { ModelsTreeIdsCache } from "../../../../components/trees/stateless/models-tree/internal/ModelsTreeIdsCache";
import { defaultHierarchyConfiguration, ModelsTreeDefinition } from "../../../../components/trees/stateless/models-tree/ModelsTreeDefinition";
import { createIModelAccess } from "../../Common";

import type { IModelConnection } from "@itwin/core-frontend";
import type { HierarchyNodeIdentifiersPath } from "@itwin/presentation-hierarchies";

type ModelsTreeHierarchyConfiguration = ConstructorParameters<typeof ModelsTreeDefinition>[0]["hierarchyConfig"];

interface CreateModelsTreeProviderProps {
  imodel: IModelConnection;
  filteredNodePaths?: HierarchyNodeIdentifiersPath[];
  hierarchyConfig?: Partial<ModelsTreeHierarchyConfiguration>;
}

export function createModelsTreeProvider({ imodel, filteredNodePaths, hierarchyConfig }: CreateModelsTreeProviderProps) {
  const config = { ...defaultHierarchyConfiguration, ...hierarchyConfig };
  const imodelAccess = createIModelAccess(imodel);
  const idsCache = new ModelsTreeIdsCache(imodelAccess, config);
  return createHierarchyProvider({
    imodelAccess,
    hierarchyDefinition: new ModelsTreeDefinition({
      imodelAccess,
      idsCache,
      hierarchyConfig: config,
    }),
    ...(filteredNodePaths ? { filtering: { paths: filteredNodePaths } } : undefined),
  });
}
