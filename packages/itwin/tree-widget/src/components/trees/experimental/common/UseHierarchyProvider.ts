/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { useDebouncedAsyncValue } from "@itwin/components-react";
import {
  HierarchyNodeIdentifiersPath,
  HierarchyProvider,
  IHierarchyLevelDefinitionsFactory,
  ILimitingECSqlQueryExecutor,
} from "@itwin/presentation-hierarchies";
import { IECClassHierarchyInspector, IECMetadataProvider } from "@itwin/presentation-shared";
import { useCallback, useEffect, useState } from "react";

/** @internal */
export type IModelAccess = IECMetadataProvider & ILimitingECSqlQueryExecutor & IECClassHierarchyInspector;

/** @internal */
export interface GetFilteredPathsProps {
  imodelAccess: IModelAccess;
  filter: string;
}

interface UseHierarchyProviderProps {
  filter: string;
  imodelAccess: IModelAccess;
  getHierarchyDefinitionsProvider: (props: { imodelAccess: IModelAccess }) => IHierarchyLevelDefinitionsFactory;
  getFilteredPaths?: (props: GetFilteredPathsProps) => Promise<HierarchyNodeIdentifiersPath[]>;
}

/** @internal */
export function useHierarchyProvider({ imodelAccess, filter, getHierarchyDefinitionsProvider, getFilteredPaths }: UseHierarchyProviderProps) {
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
        imodelAccess,
        filter,
      });
    }, [imodelAccess, setIsFiltering, filter]),
  );

  useEffect(() => {
    setIsFiltering(false);
    setHierarchyProvider(
      new HierarchyProvider({
        imodelAccess,
        hierarchyDefinition: getHierarchyDefinitionsProvider({ imodelAccess }),
        filtering: filteredPaths
          ? {
              paths: filteredPaths,
            }
          : undefined,
      }),
    );
  }, [imodelAccess, filteredPaths, getHierarchyDefinitionsProvider]);

  return { hierarchyProvider, isFiltering };
}
