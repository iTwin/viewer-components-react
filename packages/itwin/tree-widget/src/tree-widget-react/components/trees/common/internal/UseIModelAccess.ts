/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { useMemo } from "react";
import { createECSchemaProvider, createECSqlQueryExecutor } from "@itwin/presentation-core-interop";
import { createLimitingECSqlQueryExecutor } from "@itwin/presentation-hierarchies";
import { createCachingECClassHierarchyInspector } from "@itwin/presentation-shared";
import { TreeWidget } from "../../../../TreeWidget.js";
import { LOGGING_NAMESPACE } from "../Utils.js";

import type { FunctionProps} from "../Utils.js";
import type { IModelConnection } from "@itwin/core-frontend";
import type { SchemaContext } from "@itwin/ecschema-metadata";
import type { useIModelTree } from "@itwin/presentation-hierarchies-react";

type IModelAccess = FunctionProps<typeof useIModelTree>["imodelAccess"];

export interface UseIModelAccessProps {
    imodel: IModelConnection;
    getSchemaContext: (imodel: IModelConnection) => SchemaContext;
    treeName: string;
    imodelAccess?: IModelAccess;
    hierarchyLevelSizeLimit?: number;
}

/** @internal */
export function useIModelAccess({imodel, getSchemaContext, treeName, imodelAccess: providedIModelAccess, hierarchyLevelSizeLimit}: UseIModelAccessProps): {
  imodelAccess: IModelAccess;
  currentHierarchyLevelSizeLimit: number;
} {
    const defaultHierarchyLevelSizeLimit = hierarchyLevelSizeLimit ?? 1000;
    const imodelAccess = useMemo(() => {
      TreeWidget.logger.logInfo(
        `${LOGGING_NAMESPACE}.${treeName}`,
        `iModel changed, now using ${providedIModelAccess ? "provided imodel access" : `"${imodel.name}"`}`,
      );
      return providedIModelAccess ?? createIModelAccess({ getSchemaContext, imodel, hierarchyLevelSizeLimit: defaultHierarchyLevelSizeLimit });
    }, [providedIModelAccess, getSchemaContext, imodel, treeName, defaultHierarchyLevelSizeLimit]);

    return {
      imodelAccess,
      currentHierarchyLevelSizeLimit: defaultHierarchyLevelSizeLimit,
    }
}

function createIModelAccess({
  imodel,
  getSchemaContext,
  hierarchyLevelSizeLimit,
}: {
  imodel: IModelConnection;
  getSchemaContext: (imodel: IModelConnection) => SchemaContext;
  hierarchyLevelSizeLimit: number;
}) {
  const schemas = getSchemaContext(imodel);
  const schemaProvider = createECSchemaProvider(schemas);
  return {
    imodelKey: imodel.key,
    ...schemaProvider,
    ...createCachingECClassHierarchyInspector({ schemaProvider, cacheSize: 100 }),
    ...createLimitingECSqlQueryExecutor(createECSqlQueryExecutor(imodel), hierarchyLevelSizeLimit),
  };
}
