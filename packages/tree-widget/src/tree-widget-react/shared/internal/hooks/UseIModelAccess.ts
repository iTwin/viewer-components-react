/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { useMemo } from "react";
import { createECSchemaProvider, createECSqlQueryExecutor } from "@itwin/presentation-core-interop";
import { createLimitingECSqlQueryExecutor } from "@itwin/presentation-hierarchies";
import { createCachingECClassHierarchyInspector } from "@itwin/presentation-shared";
import { useLogger } from "../../contexts/LoggerContext.js";

import type { IModelConnection } from "@itwin/core-frontend";
import type { useIModelTree } from "@itwin/presentation-hierarchies-react";
import type { FunctionProps } from "../../Utils.js";

type IModelAccess = FunctionProps<typeof useIModelTree>["imodelAccess"];

export interface UseIModelAccessProps {
  imodel: IModelConnection;
  treeName: string;
  imodelAccess?: IModelAccess;
  hierarchyLevelSizeLimit?: number;
}

/** @internal */
export function useIModelAccess({ imodel, treeName, imodelAccess: providedIModelAccess, hierarchyLevelSizeLimit }: UseIModelAccessProps): {
  imodelAccess: IModelAccess;
  currentHierarchyLevelSizeLimit: number;
} {
  const defaultHierarchyLevelSizeLimit = hierarchyLevelSizeLimit ?? 1000;
  const { logger } = useLogger();
  const imodelAccess = useMemo(() => {
    logger.logInfo(treeName, `iModel changed, now using ${providedIModelAccess ? "provided imodel access" : `"${imodel.name}"`}`);
    return providedIModelAccess ?? createIModelAccess({ imodel, hierarchyLevelSizeLimit: defaultHierarchyLevelSizeLimit });
  }, [providedIModelAccess, imodel, treeName, defaultHierarchyLevelSizeLimit, logger]);

  return {
    imodelAccess,
    currentHierarchyLevelSizeLimit: defaultHierarchyLevelSizeLimit,
  };
}

/** @internal */
export function createIModelAccess({ imodel, hierarchyLevelSizeLimit }: { imodel: IModelConnection; hierarchyLevelSizeLimit: number | "unbounded" }) {
  const schemaProvider = createECSchemaProvider(imodel.schemaContext);
  return {
    imodelKey: imodel.key,
    ...schemaProvider,
    ...createCachingECClassHierarchyInspector({ schemaProvider, cacheSize: 100 }),
    ...createLimitingECSqlQueryExecutor(createECSqlQueryExecutor(imodel), hierarchyLevelSizeLimit),
  };
}
