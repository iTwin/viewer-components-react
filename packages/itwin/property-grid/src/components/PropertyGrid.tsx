/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import "./PropertyGrid.scss";
import { FillCentered } from "@itwin/core-react";
import { usePropertyDataProviderWithUnifiedSelection } from "@itwin/presentation-components";
import { useDataProvider } from "../hooks/UseDataProvider";
import { PropertyGridManager } from "../PropertyGridManager";
import { PropertyGridContent } from "./PropertyGridContent";

import type { IModelConnection } from "@itwin/core-frontend";
import type { DataProviderProps } from "../hooks/UseDataProvider";
import type { PropertyGridContentProps } from "./PropertyGridContent";

/** Props for `PropertyGrid` component. */
export type PropertyGridProps = Omit<PropertyGridContentProps, "dataProvider"> & DataProviderProps;

/** Component that renders property grid for instances in `UnifiedSelection`. */
export function PropertyGrid({ createDataProvider, ...props }: PropertyGridProps) {
  const { dataProvider, isOverLimit } = useUnifiedSelectionDataProvider({ imodel: props.imodel, createDataProvider });

  if (isOverLimit) {
    return (
      <FillCentered style={{ flexDirection: "column" }}>
        <div className="property-grid-react-filtering-pg-label">
          {PropertyGridManager.translate(
            "context-menu.selection.too-many-elements-selected"
          )}
        </div>
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

