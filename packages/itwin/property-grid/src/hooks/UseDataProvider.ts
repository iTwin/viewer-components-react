/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { useCallback } from "react";
import { useDisposable } from "@itwin/core-react";
import { PresentationPropertyDataProvider } from "@itwin/presentation-components";

import type { IModelConnection } from "@itwin/core-frontend";
import type { IPresentationPropertyDataProvider } from "@itwin/presentation-components";

/** Props for configuring default data provider used by `PropertyGrid` */
export interface DefaultDataProviderProps {
  /** Flag that specified whether data provider should create `Favorites` category. */
  enableFavoriteProperties?: boolean;
  /** Flag that specified whether nested property categories are enabled. */
  enablePropertyGroupNesting?: boolean;
  /** Id of ruleset that should be used when pulling data. */
  rulesetId?: string;
}

/** Props for providing custom data provider that will be used by `PropertyGrid` */
export interface CustomDataProviderProps {
  /** Callback that creates custom data provider that should be used instead of default one. */
  createDataProvider: (imodel: IModelConnection) => IPresentationPropertyDataProvider;
}

/** Props for data provider used by `PropertyGrid`. */
export type DataProviderProps = DefaultDataProviderProps | CustomDataProviderProps;

/** Custom hook that creates default data provider. */
export function useDefaultDataProvider({ imodel, rulesetId, enableFavoriteProperties, enablePropertyGroupNesting }: DefaultDataProviderProps & { imodel: IModelConnection }) {
  return useDisposable(useCallback(
    () => {
      const dp = new PresentationPropertyDataProvider({
        imodel,
        ruleset: rulesetId,
        disableFavoritesCategory: !enableFavoriteProperties,
      });

      dp.pagingSize = 50;
      dp.isNestedPropertyCategoryGroupingEnabled = !!enablePropertyGroupNesting;
      return dp;
    },
    [imodel, rulesetId, enableFavoriteProperties, enablePropertyGroupNesting])
  );
}

/** Custom hook that creates custom data provider. */
export function useCustomDataProvider({ imodel, createDataProvider }: CustomDataProviderProps & { imodel: IModelConnection }) {
  return useDisposable(useCallback(
    () => createDataProvider(imodel),
    [createDataProvider, imodel])
  );
}
