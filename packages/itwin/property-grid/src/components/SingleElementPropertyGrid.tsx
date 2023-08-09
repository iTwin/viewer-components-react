/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { useEffect } from "react";
import { KeySet } from "@itwin/presentation-common";
import { useDataProvider } from "../hooks/UseDataProvider";
import { PropertyGridContent } from "./PropertyGridContent";

import type { IModelConnection } from "@itwin/core-frontend";
import type { InstanceKey } from "@itwin/presentation-common";
import type { PropertyGridContentProps } from "./PropertyGridContent";
import type {  DataProviderProps } from "../hooks/UseDataProvider";

/**
 * Props for data provider used by `SingleElementPropertyGrid`.
 * @public
 */
export interface SingleElementDataProviderProps extends DataProviderProps {
  /** Key of the instance which data should be loaded. */
  instanceKey: InstanceKey;
}

/**
 * Props for `SingleElementPropertyGrid` component.
 * @public
 */
export type SingleElementPropertyGridProps = Omit<PropertyGridContentProps, "dataProvider" | "dataRenderer"> & SingleElementDataProviderProps;

/**
 * Component that renders property grid for single instance.
 * @public
 */
export function SingleElementPropertyGrid({ instanceKey, createDataProvider, ...props }: SingleElementPropertyGridProps) {
  const dataProvider = useSingleElementDataProvider({ imodel: props.imodel, instanceKey, createDataProvider  });

  return (
    <PropertyGridContent
      {...props}
      dataProvider={dataProvider}
    />
  );
}

/** Custom hook that creates data provider and setup it to load data for specific instance. */
function useSingleElementDataProvider({ instanceKey, ...props }: SingleElementDataProviderProps & { imodel: IModelConnection }) {
  const dataProvider = useDataProvider(props);
  useEffect(() => {
    dataProvider.keys = new KeySet([instanceKey]);
  }, [dataProvider, instanceKey]);
  return dataProvider;
}
