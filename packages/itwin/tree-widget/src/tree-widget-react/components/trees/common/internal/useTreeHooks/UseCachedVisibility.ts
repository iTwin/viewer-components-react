/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { useCallback, useEffect, useState } from "react";

import type { Viewport } from "@itwin/core-frontend";
import type { HierarchyFilteringPath } from "@itwin/presentation-hierarchies";
import type { VisibilityTreeProps } from "../../components/VisibilityTree.js";

/** @internal */
export type UseCachedVisibilityProps<TCache, TFactorySpecificProps> = {
  activeView: Viewport;
  getCache: () => TCache;
  factoryProps: TFactorySpecificProps;
  createFactory: (props: {
    activeView: Viewport;
    idsCacheGetter: () => TCache;
    filteredPaths: HierarchyFilteringPath[] | undefined;
    factoryProps: TFactorySpecificProps;
  }) => VisibilityTreeProps["visibilityHandlerFactory"];
};

/** @internal */
export function useCachedVisibility<TCache, TFactorySpecificProps extends object | undefined>(props: UseCachedVisibilityProps<TCache, TFactorySpecificProps>) {
  const [filteredPaths, setFilteredPaths] = useState<HierarchyFilteringPath[] | undefined>(undefined);
  const { activeView, getCache, factoryProps, createFactory } = props;

  const [visibilityHandlerFactory, setVisibilityHandlerFactory] = useState<VisibilityTreeProps["visibilityHandlerFactory"]>(() =>
    createFactory({ activeView, idsCacheGetter: getCache, filteredPaths, factoryProps }),
  );

  useEffect(() => {
    setVisibilityHandlerFactory(() => createFactory({ activeView, idsCacheGetter: getCache, filteredPaths, factoryProps }));
  }, [activeView, getCache, factoryProps, filteredPaths, createFactory]);

  return {
    visibilityHandlerFactory,
    onFilteredPathsChanged: useCallback((paths: HierarchyFilteringPath[] | undefined) => setFilteredPaths(paths), []),
    filteredPaths,
  };
}
