/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { useMemo } from "react";
import { assert } from "@itwin/core-bentley";
import { useSharedTreeContextInternal } from "../common/internal/SharedTreeWidgetContextProviderInternal.js";
import { createIModelAccess } from "../common/internal/UseIModelAccess.js";
import { getClassesByView } from "../common/internal/Utils.js";
import { ClassificationsTreeDefinition } from "./ClassificationsTreeDefinition.js";
import { ClassificationsTreeIdsCache } from "./internal/ClassificationsTreeIdsCache.js";

import type { IModelConnection } from "@itwin/core-frontend";
import type { HierarchyDefinition } from "@itwin/presentation-hierarchies";
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
  imodels: Array<{
    /**
     * iModel connection that should be used to pull data from.
     */
    imodel: IModelConnection;
  }>;
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
  const { imodels, hierarchyConfig, search } = props;
  const { getBaseIdsCache, getCache } = useSharedTreeContextInternal();
  const cacheKey = `${hierarchyConfig.rootClassificationSystemCode}-ClassificationsTreeIdsCache`;

  const imodelsWithAccess = useMemo(
    () => imodels.map((entry) => ({ imodelAccess: createIModelAccess({ imodel: entry.imodel, hierarchyLevelSizeLimit: "unbounded" }), imodel: entry.imodel })),
    [imodels],
  );

  const definition = useMemo(() => {
    return new ClassificationsTreeDefinition({
      imodelAccess: imodelsWithAccess[imodelsWithAccess.length - 1].imodelAccess,
      getIdsCache: (imodelKey: string) => {
        const entry = imodelsWithAccess.find(({ imodel }) => imodel.key === imodelKey);
        assert(!!entry);
        return getCache({
          imodel: entry.imodel,
          createCache: () =>
            new ClassificationsTreeIdsCache({
              baseIdsCache: getBaseIdsCache({ type: "3d", elementClassName: getClassesByView("3d").elementClass, imodel: entry.imodel }),
              hierarchyConfig,
              queryExecutor: entry.imodelAccess,
            }),
          cacheKey,
        });
      },
      hierarchyConfig,
    });
  }, [imodelsWithAccess, hierarchyConfig, getBaseIdsCache, getCache, cacheKey]);

  const searchTerm = search ? ("searchText" in search ? search.searchText : search.targetItems) : undefined;
  const getSearchPaths = useMemo<FunctionProps<typeof useTree>["getSearchPaths"]>(() => {
    if (!searchTerm) {
      return undefined;
    }

    return async ({ abortSignal }) => {
      const [first, ...rest] = await Promise.all(
        imodelsWithAccess.map(async ({ imodelAccess, imodel }) => {
          const idsCache = getCache({
            imodel,
            createCache: () =>
              new ClassificationsTreeIdsCache({
                baseIdsCache: getBaseIdsCache({ type: "3d", elementClassName: getClassesByView("3d").elementClass, imodel }),
                hierarchyConfig,
                queryExecutor: imodelAccess,
              }),
            cacheKey,
          });
          return ClassificationsTreeDefinition.createInstanceKeyPaths({
            hierarchyConfig,
            idsCache,
            imodelAccess,
            abortSignal,
            limit: typeof searchTerm !== "string" ? "unbounded" : undefined,
            ...(typeof searchTerm === "string" ? { label: searchTerm } : { targetItems: searchTerm }),
          });
        }),
      );

      return first.concat(...rest);
    };
  }, [searchTerm, imodelsWithAccess, getBaseIdsCache, getCache, cacheKey, hierarchyConfig]);

  return {
    definition,
    getSearchPaths,
  };
}
