/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import "./PropertyGrid.scss";
import { FillCentered } from "@itwin/core-react";
import { usePropertyDataProviderWithUnifiedSelection } from "@itwin/presentation-components";
import { useCustomDataProvider, useDefaultDataProvider } from "../hooks/UseDataProvider";
import { PropertyGridManager } from "../PropertyGridManager";
import { PropertyGridContent } from "./PropertyGridContent";

import type { IModelConnection } from "@itwin/core-frontend";
import type { CustomDataProviderProps , DataProviderProps , DefaultDataProviderProps } from "../hooks/UseDataProvider";
import type { PropertyGridContentProps } from "./PropertyGridContent";

/** Props for `PropertyGrid` component. */
export type PropertyGridProps = Omit<PropertyGridContentProps, "dataProvider"> & DataProviderProps;

/** Component that renders property grid for instances in `UnifiedSelection`. */
export function PropertyGrid(props: PropertyGridProps) {
  if (isCustomPropertyGridProps(props)) {
    return <CustomPropertyGrid {...props} />;
  }

  return <DefaultPropertyGrid {...props} />;
}

function DefaultPropertyGrid({ enableFavoriteProperties, enablePropertyGroupNesting, rulesetId, ...props }: PropertyGridProps & DefaultDataProviderProps) {
  const { dataProvider, isOverLimit } = useUnifiedSelectionDataProvider({
    imodel: props.imodel,
    enableFavoriteProperties,
    enablePropertyGroupNesting,
    rulesetId,
  });

  return <PropertyGridWithProvider
    {...props}
    dataProvider={dataProvider}
    isOverLimit={isOverLimit}
  />;
}

function CustomPropertyGrid({ createDataProvider, ...props }: PropertyGridProps & CustomDataProviderProps) {
  const { dataProvider, isOverLimit } = useUnifiedSelectionCustomDataProvider({
    imodel: props.imodel,
    createDataProvider,
  });

  return <PropertyGridWithProvider
    {...props}
    dataProvider={dataProvider}
    isOverLimit={isOverLimit}
  />;
}

function PropertyGridWithProvider({ isOverLimit, ...props }: PropertyGridContentProps & { isOverLimit: boolean }) {
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
    />
  );
}

/** Custom hook that creates default data provider and hooks provider into unified selection. */
function useUnifiedSelectionDataProvider(props: DefaultDataProviderProps & { imodel: IModelConnection }) {
  const dataProvider = useDefaultDataProvider(props);
  const { isOverLimit } = usePropertyDataProviderWithUnifiedSelection({ dataProvider });
  return { dataProvider, isOverLimit };
}

/** Custom hook that creates custom data provider and hooks provider into unified selection. */
function useUnifiedSelectionCustomDataProvider(props: CustomDataProviderProps & { imodel: IModelConnection }) {
  const dataProvider = useCustomDataProvider(props);
  const { isOverLimit } = usePropertyDataProviderWithUnifiedSelection({ dataProvider });
  return { dataProvider, isOverLimit };
}

function isCustomPropertyGridProps(props: PropertyGridProps): props is PropertyGridProps & CustomDataProviderProps {
  return (props as CustomDataProviderProps).createDataProvider !== undefined;
}
