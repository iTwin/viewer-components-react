/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { useCallback, useEffect } from "react";
import { useDisposable } from "@itwin/core-react";
import { KeySet } from "@itwin/presentation-common";
import { PresentationPropertyDataProvider , usePropertyDataProviderWithUnifiedSelection } from "@itwin/presentation-components";

import type { IModelConnection } from "@itwin/core-frontend";
import type { InstanceKey } from "@itwin/presentation-common";

/** Props for `useUnifiedSelectionDataProvider` hook. */
export interface DataProviderProps {
  /** IModelConnection to pull data from. */
  imodel: IModelConnection;
  /** Flag that specified whether properties favorite properties support should be enabled or not. */
  enableFavoriteProperties?: boolean;
  /** Flag that specified whether nested property categories are enabled. */
  enablePropertyGroupNesting?: boolean;
  /** Id of ruleset that should be used when pulling data. */
  rulesetId?: string;
  /** Custom data provider that should be used instead of the default one. */
  dataProvider?: PresentationPropertyDataProvider;
}

/** Custom hook that creates data provider or uses the supplied one and hooks provider into unified selection. */
export function useUnifiedSelectionDataProvider(props: DataProviderProps) {
  const dataProvider = useDataProvider(props);
  const { isOverLimit } = usePropertyDataProviderWithUnifiedSelection({ dataProvider });
  return { dataProvider, isOverLimit };
}

/** Props for `useSingleElementDataProvider` hook. */
export interface SingleElementDataProviderProps extends DataProviderProps {
  /** Key of the instance which data should be loaded. */
  instanceKey: InstanceKey;
}

/** Custom hook that creates data provider or uses the supplied one and setup it to load data for specific instance. */
export function useSingleElementDataProvider({ instanceKey, ...props }: SingleElementDataProviderProps) {
  const dataProvider = useDataProvider(props);
  useEffect(() => {
    dataProvider.keys = new KeySet([instanceKey]);
  }, [dataProvider, instanceKey]);
  return dataProvider;
}

function useDataProvider({ imodel, dataProvider, rulesetId, enableFavoriteProperties, enablePropertyGroupNesting }: DataProviderProps) {
  return useDisposable(useCallback(
    () => {
      const dp = dataProvider ?? new PresentationPropertyDataProvider({
        imodel,
        ruleset: rulesetId,
        disableFavoritesCategory: !enableFavoriteProperties,
      });

      dp.pagingSize = 50;
      dp.isNestedPropertyCategoryGroupingEnabled = !!enablePropertyGroupNesting;
      return dp;
    },
    [dataProvider, imodel, rulesetId, enableFavoriteProperties, enablePropertyGroupNesting])
  );
}
