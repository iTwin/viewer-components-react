/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { useMemo, useRef } from "react";
import { assert } from "@itwin/core-bentley";
import { ClassificationsTreeDefinition } from "./ClassificationsTreeDefinition.js";
import { ClassificationsTreeIdsCache } from "./internal/ClassificationsTreeIdsCache.js";

import type { MutableRefObject } from "react";
import type { HierarchyDefinition } from "@itwin/presentation-hierarchies";
import type { useIModelTree, useTree } from "@itwin/presentation-hierarchies-react";
import type { FunctionProps } from "../common/Utils.js";
import type { ClassificationsTreeHierarchyConfiguration } from "./ClassificationsTreeDefinition.js";

type IModelAccess = FunctionProps<typeof useIModelTree>["imodelAccess"];

/** @alpha */
interface UseClassificationsTreeDefinitionProps {
  /**
   * List of iModels that will be used to merge tree data based on this definition.
   * First iModel in the list is considered the primary iModel and should be the latest version used.
   */
  imodelAccesses: Array<IModelAccess>;
  hierarchyConfig: ClassificationsTreeHierarchyConfiguration;
  /**
   * Optional search parameters to filter tree nodes.
   */
  search?: {
    /**
     * Text used to filter tree nodes by label.
     */
    searchText: string;
  };
}

/** @alpha */
interface UseClassificationsTreeDefinitionResult {
  definition: HierarchyDefinition;
  getFilteredPaths?: FunctionProps<typeof useTree>["getFilteredPaths"];
}

/** @alpha */
export function useClassificationsTreeDefinition(props: UseClassificationsTreeDefinitionProps): UseClassificationsTreeDefinitionResult {
  const { imodelAccesses, hierarchyConfig, search } = props;

  const idsCaches = useRef<Map<string, ClassificationsTreeIdsCache>>(new Map());

  const definition = useMemo(() => {
    return new ClassificationsTreeDefinition({
      imodelAccess: imodelAccesses[0],
      getIdsCache: (imodelKey: string) =>
        lookupIdsCache({
          imodelKey,
          imodels: imodelAccesses,
          idsCaches,
          hierarchyConfig,
        }),
      hierarchyConfig,
    });
  }, [imodelAccesses, hierarchyConfig]);

  const searchText = search?.searchText;
  const getFilteredPaths = useMemo<FunctionProps<typeof useTree>["getFilteredPaths"]>(() => {
    if (!searchText) {
      return undefined;
    }

    return async () => {
      const [first, ...rest] = await Promise.all(
        imodelAccesses.map(async (imodelAccess) =>
          ClassificationsTreeDefinition.createInstanceKeyPaths({
            hierarchyConfig,
            idsCache: lookupIdsCache({
              imodelKey: imodelAccess.imodelKey,
              imodels: imodelAccesses,
              idsCaches,
              hierarchyConfig,
            }),
            imodelAccess,
            label: searchText,
          }),
        ),
      );

      return first.concat(...rest);
    };
  }, [imodelAccesses, hierarchyConfig, searchText]);

  return {
    definition,
    getFilteredPaths,
  };
}

function lookupIdsCache({
  imodelKey,
  imodels,
  hierarchyConfig,
  idsCaches,
}: {
  imodelKey: string;
  imodels: Array<IModelAccess>;
  hierarchyConfig: ClassificationsTreeHierarchyConfiguration;
  idsCaches: MutableRefObject<Map<string, ClassificationsTreeIdsCache>>;
}) {
  let idsCache = idsCaches.current.get(imodelKey);
  if (!idsCache) {
    const imodel = imodels.find((currImodel) => currImodel.imodelKey === imodelKey);
    assert(!!imodel);
    idsCache = new ClassificationsTreeIdsCache(imodel, hierarchyConfig);
    idsCaches.current.set(imodelKey, idsCache);
  }
  return idsCache;
}
