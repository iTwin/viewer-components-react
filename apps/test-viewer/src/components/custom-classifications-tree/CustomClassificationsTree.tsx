/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { useCallback, useEffect, useMemo, useState } from "react";
import { CheckpointConnection } from "@itwin/core-frontend";
import { createECSchemaProvider, createECSqlQueryExecutor } from "@itwin/presentation-core-interop";
import { createIModelHierarchyProvider, createLimitingECSqlQueryExecutor, mergeProviders } from "@itwin/presentation-hierarchies";
import { StrataKitTreeRenderer, useTree } from "@itwin/presentation-hierarchies-react";
import { createCachingECClassHierarchyInspector } from "@itwin/presentation-shared";
import { useClassificationsTreeDefinition } from "@itwin/tree-widget-react";

import type { IModelConnection } from "@itwin/core-frontend";

const PRIMARY_CONNECTION = {
  iTwinId: "",
  iModelId: "",
};

const SECONDARY_CONNECTION = {
  iTwinId: "",
  iModelId: "",
};

export function CustomClassificationsTree(props: { filter?: string }) {
  const [state, setState] = useState<{ primary: IModelConnection; checkpoint: IModelConnection } | undefined>(undefined);

  useEffect(() => {
    let disposed = false;
    async function loadIModels() {
      const primaryConnection = await CheckpointConnection.openRemote(PRIMARY_CONNECTION.iTwinId, PRIMARY_CONNECTION.iModelId);
      const checkpointConnection = await CheckpointConnection.openRemote(SECONDARY_CONNECTION.iTwinId, SECONDARY_CONNECTION.iModelId);
      if (disposed) {
        return;
      }

      setState({ primary: primaryConnection, checkpoint: checkpointConnection });
    }

    void loadIModels();
    return () => {
      disposed = true;
    };
  }, []);

  if (!state) {
    return null;
  }

  const { primary, checkpoint } = state;
  return <CustomClassificationTreeImpl {...props} primaryIModel={primary} checkpointIModel={checkpoint} />;
}

function CustomClassificationTreeImpl({
  primaryIModel,
  checkpointIModel,
  filter,
}: {
  primaryIModel: IModelConnection;
  checkpointIModel: IModelConnection;
  filter?: string;
}) {
  const primaryAccess = useMemo(() => {
    const schemaProvider = createECSchemaProvider(primaryIModel.schemaContext);
    return {
      imodelKey: primaryIModel.key,
      ...createECSchemaProvider(primaryIModel.schemaContext),
      ...createCachingECClassHierarchyInspector({ schemaProvider, cacheSize: 100 }),
      ...createLimitingECSqlQueryExecutor(createECSqlQueryExecutor(primaryIModel), 1000),
    };
  }, [primaryIModel]);

  const checkpointAccess = useMemo(() => {
    const schemaProvider = createECSchemaProvider(checkpointIModel.schemaContext);
    return {
      imodelKey: checkpointIModel.key,
      ...createECSchemaProvider(checkpointIModel.schemaContext),
      ...createCachingECClassHierarchyInspector({ schemaProvider, cacheSize: 100 }),
      ...createLimitingECSqlQueryExecutor(createECSqlQueryExecutor(checkpointIModel), 1000),
    };
  }, [checkpointIModel]);

  const { definition, getFilteredPaths } = useClassificationsTreeDefinition({
    imodelAccesses: useMemo(() => [primaryAccess, checkpointAccess], [primaryAccess, checkpointAccess]),
    hierarchyConfig: useMemo(
      () => ({
        rootClassificationSystemCode: "50k classifications",
      }),
      [],
    ),
    search: filter ? { searchText: filter } : undefined,
  });

  const treeProps = useTree({
    getHierarchyProvider: useCallback(() => {
      return mergeProviders({
        providers: [
          createIModelHierarchyProvider({
            hierarchyDefinition: definition,
            imodelAccess: primaryAccess,
          }),
          createIModelHierarchyProvider({
            hierarchyDefinition: definition,
            imodelAccess: checkpointAccess,
          }),
        ],
      });
    }, [definition, primaryAccess, checkpointAccess]),
    getFilteredPaths,
  });

  if (treeProps.isReloading) {
    return null;
  }

  if (treeProps.rootErrorRendererProps) {
    return null;
  }

  if (treeProps.treeRendererProps === undefined) {
    return null;
  }

  return (
    <div style={{ height: "100%", width: "100%" }}>
      <StrataKitTreeRenderer treeLabel="Custom-Classifications" {...treeProps.treeRendererProps} />
    </div>
  );
}
