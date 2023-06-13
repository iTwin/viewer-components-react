/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { FillCentered } from "@itwin/core-react";
import { Text } from "@itwin/itwinui-react";
import { usePropertyDataProviderWithUnifiedSelection } from "@itwin/presentation-components";
import { useDataProvider } from "../hooks/UseDataProvider";
import { PropertyGridManager } from "../PropertyGridManager";
import { PropertyGridContent } from "./PropertyGridContent";

import type { IModelConnection } from "@itwin/core-frontend";
import type { DataProviderProps } from "../hooks/UseDataProvider";
import type { PropertyGridContentProps } from "./PropertyGridContent";

/**
 * Props for `PropertyGrid` component.
 * @public
 */
export type PropertyGridProps = Omit<PropertyGridContentProps, "dataProvider"> & DataProviderProps;

/**
 * Component that renders property grid for instances in `UnifiedSelection`.
 * @public
 */
export function PropertyGrid({ createDataProvider, ...props }: PropertyGridProps) {
  const { dataProvider, isOverLimit } = useUnifiedSelectionDataProvider({ imodel: props.imodel, createDataProvider });

  if (isOverLimit) {
    return (
      <FillCentered style={{ flexDirection: "column" }}>
        <Text>{PropertyGridManager.translate("selection.too-many-elements-selected")}</Text>
      </FillCentered>
    );
  }

  return (
    <PropertyGridContent
      {...props}
      dataProvider={dataProvider}
    />
  );
}

/** Custom hook that creates data provider and hooks provider into unified selection. */
function useUnifiedSelectionDataProvider(props: DataProviderProps & { imodel: IModelConnection }) {
  const dataProvider = useDataProvider(props);
  const { isOverLimit } = usePropertyDataProviderWithUnifiedSelection({ dataProvider });
  return { dataProvider, isOverLimit };
}

