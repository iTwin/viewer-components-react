/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { useMemo, useRef } from "react";
import { assert } from "@itwin/core-bentley";
import { ClassificationsTreeDefinition } from "./ClassificationsTreeDefinition.js";
import { ClassificationsTreeIdsCache } from "./internal/ClassificationsTreeIdsCache.js";

import type { MutableRefObject } from "react";
import type { HierarchyDefinition, HierarchySearchPath } from "@itwin/presentation-hierarchies";
import type { useIModelTree } from "@itwin/presentation-hierarchies-react";
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
     * An object that provides access to iModel's data and metadata.
     */
    imodelAccess: FunctionProps<typeof useIModelTree>["imodelAccess"];
  }>;
  hierarchyConfig: ClassificationsTreeHierarchyConfiguration;
  /**
   * Optional search parameters to filter tree nodes.
   */
  search?:
    | {
        /**
         * Text used to filter tree nodes by label.
         */
        searchText: string;
      }
    | {
        /**
         * List of instance keys to filter tree nodes by.
         */
        targetItems: Array<InstanceKey>;
      };
}

/** @alpha */
interface UseClassificationsTreeDefinitionResult {
  definition: HierarchyDefinition;
  getHierarchySearchPaths?: ({ abortSignal }: { abortSignal: AbortSignal }) => Promise<HierarchySearchPath[] | undefined>;
}

/** @alpha */
export function useClassificationsTreeDefinition(props: UseClassificationsTreeDefinitionProps): UseClassificationsTreeDefinitionResult {
  const { imodels, hierarchyConfig, search } = props;

  const idsCaches = useRef<Map<string, ClassificationsTreeIdsCache>>(new Map());

  const definition = useMemo(() => {
    return new ClassificationsTreeDefinition({
      imodelAccess: imodels[imodels.length - 1].imodelAccess,
      getIdsCache: (imodelKey: string) =>
        getOrCreateIdsCache({
          imodelKey,
          imodels,
          idsCaches,
          hierarchyConfig,
        }),
      hierarchyConfig,
    });
  }, [imodels, hierarchyConfig]);

  const searchTerm = search ? ("searchText" in search ? search.searchText : search.targetItems) : undefined;
  const getHierarchySearchPaths = useMemo<(({ abortSignal }: { abortSignal: AbortSignal }) => Promise<HierarchySearchPath[] | undefined>) | undefined>(() => {
    if (!searchTerm) {
      return undefined;
    }

    return async ({ abortSignal }: { abortSignal: AbortSignal }) => {
      const [first, ...rest] = await Promise.all(
        imodels.map(async ({ imodelAccess }) =>
          ClassificationsTreeDefinition.createInstanceKeyPaths({
            hierarchyConfig,
            idsCache: getOrCreateIdsCache({
              imodelKey: imodelAccess.imodelKey,
              imodels,
              idsCaches,
              hierarchyConfig,
            }),
            imodelAccess,
            abortSignal,
            limit: typeof searchTerm !== "string" ? "unbounded" : undefined,
            ...(typeof searchTerm === "string" ? { label: searchTerm } : { targetItems: searchTerm }),
          }),
        ),
      );

      return first.concat(...rest);
    };
  }, [imodels, hierarchyConfig, searchTerm]);

  return {
    definition,
    getHierarchySearchPaths,
  };
}

function getOrCreateIdsCache({
  imodelKey,
  imodels,
  hierarchyConfig,
  idsCaches,
}: {
  imodelKey: string;
  imodels: Array<{
    imodelAccess: FunctionProps<typeof useIModelTree>["imodelAccess"];
  }>;
  hierarchyConfig: ClassificationsTreeHierarchyConfiguration;
  idsCaches: MutableRefObject<Map<string, ClassificationsTreeIdsCache>>;
}) {
  let idsCache = idsCaches.current.get(imodelKey);
  if (!idsCache) {
    const imodel = imodels.find((currImodel) => currImodel.imodelAccess.imodelKey === imodelKey);
    assert(!!imodel);
    idsCache = new ClassificationsTreeIdsCache(imodel.imodelAccess, hierarchyConfig);
    idsCaches.current.set(imodelKey, idsCache);
  }
  return idsCache;
}
