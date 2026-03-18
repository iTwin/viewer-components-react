/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { useEffect, useMemo } from "react";
import { useSharedTreeContextInternal } from "../common/internal/SharedTreeContextProviderInternal.js";
import { createIModelAccess } from "../common/internal/UseIModelAccess.js";
import { useTelemetryContext } from "../common/UseTelemetryContext.js";
import { ClassificationsTreeDefinition } from "./ClassificationsTreeDefinition.js";
import { getClassificationsTreeIdsCache } from "./UseClassificationsTree.js";

import type { IModelConnection } from "@itwin/core-frontend";
import type { HierarchyDefinition, HierarchySearchPath } from "@itwin/presentation-hierarchies";
import type { useTree } from "@itwin/presentation-hierarchies-react";
import type { InstanceKey } from "@itwin/presentation-shared";
import type { FunctionProps } from "../common/Utils.js";
import type { ClassificationsTreeHierarchyConfiguration } from "./ClassificationsTreeDefinition.js";

/** @alpha */
interface UseClassificationsTreeDefinitionProps {
  /**
   * A list of iModels to create merged hierarchy for.
   *
   * **Warning:** These **must** all be different versions of the same iModel, ordered from the earliest to the
   * latest version. Not obeying this rule may result in undefined behavior.
   */
  imodels: Array<IModelConnection>;
  hierarchyConfig: ClassificationsTreeHierarchyConfiguration;
  /**
   * Optional parameters to search for tree nodes.
   */
  search?:
    | {
        /**
         * Text used to search tree nodes by label.
         */
        searchText: string;
      }
    | {
        /**
         * List of instance keys to search tree nodes by.
         */
        targetItems: Array<InstanceKey>;
      };
  /**
   * Action to perform when search paths change.
   */
  onSearchPathsChanged?: (paths: HierarchySearchPath[] | undefined) => void;
}

/** @alpha */
interface UseClassificationsTreeDefinitionResult {
  definition: HierarchyDefinition;
  getSearchPaths?: FunctionProps<typeof useTree>["getSearchPaths"];
}

/**
 * Requires `SharedTreeContextProvider` to be present in components tree above.
 * @alpha
 */
export function useClassificationsTreeDefinition(props: UseClassificationsTreeDefinitionProps): UseClassificationsTreeDefinitionResult {
  const { imodels, hierarchyConfig, search, onSearchPathsChanged } = props;
  const { getBaseIdsCache, getCache } = useSharedTreeContextInternal();
  const { onFeatureUsed } = useTelemetryContext();

  const imodelsWithCaches = useMemo(() => {
    return imodels.map((imodel) => {
      return {
        imodelAccess: createIModelAccess({ imodel, hierarchyLevelSizeLimit: 1000 }),
        cache: getClassificationsTreeIdsCache({
          getBaseIdsCache,
          getCache,
          imodel,
          hierarchyConfigPropsThatAffectCache: hierarchyConfig,
          visibilityHandlerConfigPropsThatAffectCache: undefined,
        }),
      };
    });
  }, [imodels, getBaseIdsCache, getCache, hierarchyConfig]);

  const definition = useMemo(() => {
    return new ClassificationsTreeDefinition({
      imodelAccess: imodelsWithCaches[imodelsWithCaches.length - 1].imodelAccess,
      getIdsCache: (imodelKey: string) => imodelsWithCaches.find(({ imodelAccess }) => imodelAccess.imodelKey === imodelKey)!.cache,
      hierarchyConfig,
    });
  }, [hierarchyConfig, imodelsWithCaches]);

  const searchTerm = search ? ("searchText" in search ? search.searchText : search.targetItems) : undefined;

  useEffect(() => {
    if (!searchTerm) {
      onSearchPathsChanged?.(undefined);
    }
  }, [onSearchPathsChanged, searchTerm]);

  const getSearchPaths = useMemo<FunctionProps<typeof useTree>["getSearchPaths"]>(() => {
    if (!searchTerm) {
      return undefined;
    }

    return async ({ abortSignal }) => {
      onFeatureUsed({ featureId: "search", reportInteraction: true });
      const [first, ...rest] = await Promise.all(
        imodelsWithCaches.map(async ({ imodelAccess, cache }) => {
          return ClassificationsTreeDefinition.createInstanceKeyPaths({
            hierarchyConfig,
            idsCache: cache,
            imodelAccess,
            abortSignal,
            limit: typeof searchTerm !== "string" ? "unbounded" : undefined,
            ...(typeof searchTerm === "string" ? { label: searchTerm } : { targetItems: searchTerm }),
          });
        }),
      );

      const joinedPaths = first.concat(...rest);
      onSearchPathsChanged?.(joinedPaths);
      return joinedPaths;
    };
  }, [searchTerm, onFeatureUsed, imodelsWithCaches, onSearchPathsChanged, hierarchyConfig]);

  return {
    definition,
    getSearchPaths,
  };
}
