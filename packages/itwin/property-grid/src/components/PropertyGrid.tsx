/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { Flex, Text } from "@itwin/itwinui-react";
import { usePropertyDataProviderWithUnifiedSelection } from "@itwin/presentation-components";
import { useDataProvider } from "../hooks/UseDataProvider";
import { PropertyGridManager } from "../PropertyGridManager";
import { FilteringPropertyGrid } from "./FilteringPropertyGrid";
import { PropertyGridContent } from "./PropertyGridContent";

import type { DataProviderProps } from "../hooks/UseDataProvider";
import type { FilteringPropertyGridProps } from "./FilteringPropertyGrid";
import type { PropertyGridContentProps } from "./PropertyGridContent";

/**
 * Props for `PropertyGrid` component.
 * @public
 */
export type PropertyGridProps = Omit<PropertyGridContentProps, "dataProvider" | "dataRenderer"> & DataProviderProps;

/**
 * Component that renders property grid for instances in `UnifiedSelection`.
 * @public
 */
export function PropertyGrid({ createDataProvider, ...props }: PropertyGridProps) {
  const dataProvider = useDataProvider({ imodel: props.imodel, createDataProvider });
  if (!dataProvider) {
    return null;
  }

  return <UnifiedSelectionPropertyGrid {...props} dataProvider={dataProvider} />;
}

function UnifiedSelectionPropertyGrid(props: PropertyGridContentProps) {
  const { isOverLimit } = usePropertyDataProviderWithUnifiedSelection({ dataProvider: props.dataProvider });

  const dataRenderer = (dataRendererProps: FilteringPropertyGridProps) => {
    if (isOverLimit) {
      return (
        <Flex justifyContent="center" alignItems="center" flexDirection="column" style={{ width: "100%", height: "100%" }}>
          <Text>{PropertyGridManager.translate("selection.too-many-elements-selected")}</Text>
        </Flex>
      );
    }

    return <FilteringPropertyGrid {...dataRendererProps} />;
  };

  return <PropertyGridContent {...props} dataRenderer={dataRenderer} />;
}
