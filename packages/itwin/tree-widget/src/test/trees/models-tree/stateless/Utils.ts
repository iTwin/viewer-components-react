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

export function createModelsTreeProvider(imodel: IModelConnection, filteredNodePaths?: HierarchyNodeIdentifiersPath[]) {
  const imodelAccess = createIModelAccess(imodel);
  const idsCache = new ModelsTreeIdsCache(imodelAccess, defaultHierarchyConfiguration);
  return createHierarchyProvider({
    imodelAccess,
    hierarchyDefinition: new ModelsTreeDefinition({
      imodelAccess,
      idsCache,
      hierarchyConfig: defaultHierarchyConfiguration,
    }),
    ...(filteredNodePaths ? { filtering: { paths: filteredNodePaths } } : undefined),
  });
}
