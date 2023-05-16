/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { useEffect } from "react";
import { KeySet } from "@itwin/presentation-common";
import { useCustomDataProvider, useDefaultDataProvider } from "../hooks/UseDataProvider";
import { PropertyGridContent } from "./PropertyGridContent";

import type { IModelConnection } from "@itwin/core-frontend";
import type { InstanceKey } from "@itwin/presentation-common";
import type { PropertyGridContentProps } from "./PropertyGridContent";
import type { CustomDataProviderProps, DefaultDataProviderProps } from "../hooks/UseDataProvider";

/** Base props for data provider used by `SingleElementPropertyGrid. */
export interface SingleElementDataProviderBaseProps {
  /** Key of the instance which data should be loaded. */
  instanceKey: InstanceKey;
}

/** Props for configuring default data provider used by `SingleElementPropertyGrid`. */
export type SingleElementDefaultDataProviderProps = DefaultDataProviderProps & SingleElementDataProviderBaseProps;

/** Props for providing custom data provider that will be used by `SingleElementPropertyGrid`. */
export type SingleElementCustomDataProviderProps = CustomDataProviderProps & SingleElementDataProviderBaseProps;

/** Props for data provider used by `SingleElementPropertyGrid`. */
export type SingleElementDataProviderProps = SingleElementDefaultDataProviderProps | SingleElementCustomDataProviderProps;

/** Props for `SingleElementPropertyGrid` component. */
export type SingleElementPropertyGridProps = Omit<PropertyGridContentProps, "dataProvider"> & SingleElementDataProviderProps;

/** Component that renders property grid for single element. */
export function SingleElementPropertyGrid(props: SingleElementPropertyGridProps) {
  if (isCustomDataProviderProps(props)) {
    return <SingleElementCustomPropertyGrid {...props} />;
  }

  return <SingleElementDefaultPropertyGrid {...props} />;
}

function SingleElementDefaultPropertyGrid({ instanceKey, enableFavoriteProperties, enablePropertyGroupNesting, rulesetId,...props }: SingleElementPropertyGridProps & SingleElementDefaultDataProviderProps) {
  const dataProvider = useSingleElementDataProvider({
    imodel: props.imodel,
    instanceKey,
    enableFavoriteProperties,
    enablePropertyGroupNesting,
    rulesetId,
  });

  return (
    <PropertyGridContent
      {...props}
      dataProvider={dataProvider}
    />
  );
}

function SingleElementCustomPropertyGrid({ instanceKey, createDataProvider,...props }: SingleElementPropertyGridProps & SingleElementCustomDataProviderProps) {
  const dataProvider = useSingleElementCustomDataProvider({
    imodel: props.imodel,
    instanceKey,
    createDataProvider,
  });

  return (
    <PropertyGridContent
      {...props}
      dataProvider={dataProvider}
    />
  );
}

/** Custom hook that creates data provider and setup it to load data for specific instance. */
function useSingleElementDataProvider({ instanceKey, ...props }: SingleElementDefaultDataProviderProps & { imodel: IModelConnection }) {
  const dataProvider = useDefaultDataProvider(props);
  useEffect(() => {
    dataProvider.keys = new KeySet([instanceKey]);
  }, [dataProvider, instanceKey]);
  return dataProvider;
}

/** Custom hook that creates custom data provider and setup it to load data for specific instance. */
function useSingleElementCustomDataProvider({ instanceKey, ...props }: SingleElementCustomDataProviderProps & { imodel: IModelConnection }) {
  const dataProvider = useCustomDataProvider(props);
  useEffect(() => {
    dataProvider.keys = new KeySet([instanceKey]);
  }, [dataProvider, instanceKey]);
  return dataProvider;
}

function isCustomDataProviderProps(props: SingleElementPropertyGridProps): props is SingleElementPropertyGridProps & SingleElementCustomDataProviderProps {
  return (props as SingleElementCustomDataProviderProps).createDataProvider !== undefined;
}
