/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { useCallback } from "react";
import { useDisposable } from "@itwin/core-react";
import { PresentationPropertyDataProvider } from "@itwin/presentation-components";

import type { IModelConnection } from "@itwin/core-frontend";
import type { IPresentationPropertyDataProvider } from "@itwin/presentation-components";

/** Props for data provider used by `PropertyGrid` */
export interface DataProviderProps {
  /** Callback that creates custom data provider that should be used instead of default one. */
  createDataProvider?: (imodel: IModelConnection) => IPresentationPropertyDataProvider;
}

/** Custom hook that creates data provider. */
export function useDataProvider({ imodel, createDataProvider }: DataProviderProps & { imodel: IModelConnection }) {
  return useDisposable(
    useCallback(
      () => createDataProvider ? createDataProvider(imodel) : new PresentationPropertyDataProvider({ imodel }),
      [imodel, createDataProvider]
    )
  );
}

