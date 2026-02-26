/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { useCallback, useEffect, useMemo, useState } from "react";
import { IModelVersion } from "@itwin/core-common";
import { CheckpointConnection } from "@itwin/core-frontend";
import { createECSchemaProvider, createECSqlQueryExecutor } from "@itwin/presentation-core-interop";
import { createLimitingECSqlQueryExecutor, createMergedIModelHierarchyProvider } from "@itwin/presentation-hierarchies";
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
  changesetId: "",
};

export function CustomClassificationsTree(props: { searchText?: string }) {
  const [state, setState] = useState<{ latest: IModelConnection; checkpoint: IModelConnection } | undefined>(undefined);

  useEffect(() => {
    let disposed = false;
    async function loadIModels() {
      const latestConnection = await CheckpointConnection.openRemote(PRIMARY_CONNECTION.iTwinId, PRIMARY_CONNECTION.iModelId, IModelVersion.latest());
      const checkpointConnection = await CheckpointConnection.openRemote(
        SECONDARY_CONNECTION.iTwinId,
        SECONDARY_CONNECTION.iModelId,
        IModelVersion.asOfChangeSet(SECONDARY_CONNECTION.changesetId),
      );
      if (disposed) {
        return;
      }

      setState({ latest: latestConnection, checkpoint: checkpointConnection });
    }

    void loadIModels();
    return () => {
      disposed = true;
    };
  }, []);

  if (!state) {
    return null;
  }

  const { latest, checkpoint } = state;
  return <CustomClassificationTreeImpl {...props} latestIModel={latest} checkpointIModel={checkpoint} />;
}

function CustomClassificationTreeImpl({
  latestIModel,
  checkpointIModel,
  searchText,
}: {
  latestIModel: IModelConnection;
  checkpointIModel: IModelConnection;
  searchText?: string;
}) {
  const latestAccess = useMemo(() => {
    const schemaProvider = createECSchemaProvider(latestIModel.schemaContext);
    return {
      imodelKey: latestIModel.key,
      ...createECSchemaProvider(latestIModel.schemaContext),
      ...createCachingECClassHierarchyInspector({ schemaProvider, cacheSize: 100 }),
      ...createLimitingECSqlQueryExecutor(createECSqlQueryExecutor(latestIModel), 1000),
    };
  }, [latestIModel]);

  const checkpointAccess = useMemo(() => {
    const schemaProvider = createECSchemaProvider(checkpointIModel.schemaContext);
    return {
      imodelKey: checkpointIModel.key,
      ...createECSchemaProvider(checkpointIModel.schemaContext),
      ...createCachingECClassHierarchyInspector({ schemaProvider, cacheSize: 100 }),
      ...createLimitingECSqlQueryExecutor(createECSqlQueryExecutor(checkpointIModel), 1000),
    };
  }, [checkpointIModel]);
  const imodelConnections = useMemo(() => [{ imodelAccess: checkpointAccess }, { imodelAccess: latestAccess }], [latestAccess, checkpointAccess]);
  const imodels = useMemo(() => [{ imodel: checkpointIModel }, { imodel: latestIModel }], [latestIModel, checkpointIModel]);
  const { definition, getSearchPaths } = useClassificationsTreeDefinition({
    imodels,
    hierarchyConfig: useMemo(
      () => ({
        rootClassificationSystemCode: "50k classifications",
      }),
      [],
    ),
    search: searchText ? { searchText } : undefined,
  });
  const treeProps = useTree({
    getHierarchyProvider: useCallback(() => {
      return createMergedIModelHierarchyProvider({
        hierarchyDefinition: definition,
        imodels: imodelConnections,
      });
    }, [definition, imodelConnections]),
    getSearchPaths,
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
