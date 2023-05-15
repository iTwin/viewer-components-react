/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { useSingleElementDataProvider } from "../hooks/UseDataProvider";
import { PropertyGridContent } from "./PropertyGridContent";

import type { SingleElementDataProviderProps } from "../hooks/UseDataProvider";
import type { PropertyGridContentProps } from "./PropertyGridContent";

/** Props for `SingleElementPropertyGrid` component. */
export type SingleElementPropertyGridProps = Omit<PropertyGridContentProps, "dataProvider"> & SingleElementDataProviderProps;

/** Component that renders property grid for single element. */
export function SingleElementPropertyGrid({
  imodel,
  instanceKey,
  enableFavoriteProperties,
  enablePropertyGroupNesting,
  rulesetId,
  createDataProvider,
  ...props
}: SingleElementPropertyGridProps) {
  const dataProvider = useSingleElementDataProvider({
    imodel,
    instanceKey,
    createDataProvider,
    enableFavoriteProperties,
    enablePropertyGroupNesting,
    rulesetId,
  });

  return (
    <PropertyGridContent
      {...props}
      dataProvider={dataProvider}
      imodel={imodel}
    />
  );
}
