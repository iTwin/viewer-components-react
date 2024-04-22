/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { useDebouncedAsyncValue } from "@itwin/components-react";
import { createMetadataProvider } from "@itwin/presentation-core-interop";
import {
  HierarchyNodeIdentifiersPath,
  HierarchyProvider,
  IHierarchyLevelDefinitionsFactory,
  ILimitingECSqlQueryExecutor,
} from "@itwin/presentation-hierarchies";
import { useCallback, useEffect, useState } from "react";

export interface MetadataAccess {
  queryExecutor: ILimitingECSqlQueryExecutor;
  metadataProvider: ReturnType<typeof createMetadataProvider>;
}

export interface GetFilteredPathsProps extends MetadataAccess {
  filter: string;
}

export interface UseHierarchyProviderProps extends MetadataAccess {
  filter: string;
  getHierarchyDefinitionsProvider: (props: MetadataAccess) => IHierarchyLevelDefinitionsFactory;
  getFilteredPaths?: (props: GetFilteredPathsProps) => Promise<HierarchyNodeIdentifiersPath[]>;
}

export function useHierarchyProvider({
  queryExecutor,
  metadataProvider,
  filter,
  getHierarchyDefinitionsProvider,
  getFilteredPaths,
}: UseHierarchyProviderProps) {
  const [hierarchyProvider, setHierarchyProvider] = useState<HierarchyProvider>();
  const [isFiltering, setIsFiltering] = useState(false);

  const { value: filteredPaths } = useDebouncedAsyncValue(
    useCallback(async () => {
      setIsFiltering(false);
      if (filter === "" || !getFilteredPaths) {
        return undefined;
      }

      setIsFiltering(true);
      return await getFilteredPaths({
        metadataProvider: metadataProvider,
        queryExecutor: queryExecutor,
        filter,
      });
    }, [metadataProvider, queryExecutor, setIsFiltering, filter]),
  );

  useEffect(() => {
    setIsFiltering(false);
    setHierarchyProvider(
      new HierarchyProvider({
        metadataProvider: metadataProvider,
        queryExecutor: queryExecutor,
        hierarchyDefinition: getHierarchyDefinitionsProvider({ queryExecutor, metadataProvider }),
        filtering: filteredPaths
          ? {
              paths: filteredPaths,
            }
          : undefined,
      }),
    );
  }, [queryExecutor, metadataProvider, filteredPaths, getHierarchyDefinitionsProvider]);

  return { hierarchyProvider, isFiltering };
}
