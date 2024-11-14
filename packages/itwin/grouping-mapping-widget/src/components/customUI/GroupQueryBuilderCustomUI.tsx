/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Presentation } from "@itwin/presentation-frontend";
import type { ISelectionProvider, SelectionChangeEventArgs } from "@itwin/presentation-frontend";
import { KeySet } from "@itwin/presentation-common";
import "./GroupQueryBuilderCustomUI.scss";
import { QueryBuilder } from "../Groups/QueryBuilder/QueryBuilder";
import type { GroupingCustomUIProps } from "./GroupingMappingCustomUI";
import { DEFAULT_PROPERTY_GRID_RULESET, PresentationPropertyDataProvider } from "@itwin/presentation-components";
import type { IModelConnection } from "@itwin/core-frontend";
import type { ActionButtonRendererProps } from "@itwin/components-react";
import { VirtualizedPropertyGridWithDataProvider } from "@itwin/components-react";
import { ResizableContainerObserver } from "@itwin/core-react";
import type { PropertyRecord } from "@itwin/appui-abstract";
import { PropertyGridWrapperContext } from "../context/PropertyGridWrapperContext";
import { PropertyAction } from "../Properties/PropertyAction";
import { Alert, Button } from "@itwin/itwinui-react";
import { useGroupingMappingApiConfig } from "../context/GroupingApiConfigContext";
import { IModelApp } from "@itwin/core-frontend";

const createPropertyDataProvider = async (keys: KeySet, iModelConnection: IModelConnection): Promise<PresentationPropertyDataProvider> => {
  const dataProvider = new PresentationPropertyDataProvider({
    imodel: iModelConnection,
    ruleset: DEFAULT_PROPERTY_GRID_RULESET,
  });
  dataProvider.keys = keys;
  dataProvider.isNestedPropertyCategoryGroupingEnabled = true;
  const data = await dataProvider.getData();
  const selectedCategory = data.categories.find(
    (category) => category.label === IModelApp.localization.getLocalizedString("Presentation:selectedItems.categoryLabel"),
  );
  if (selectedCategory) {
    selectedCategory.expand = true;
  }
  return dataProvider;
};

interface ContainerDimensions {
  width: number;
  height: number;
}

/**
 * A default group query builder for the Grouping Mapping Widget that uses the property grid to generate queries.
 * @public
 */
export const GroupQueryBuilderCustomUI = ({ updateQuery, isUpdating, resetView }: GroupingCustomUIProps) => {
  const { iModelConnection } = useGroupingMappingApiConfig();
  if (!iModelConnection) {
    throw new Error("This component requires an active iModelConnection.");
  }
  const [size, setSize] = useState<ContainerDimensions>({ width: 0, height: 0 });
  const [dataProvider, setDataProvider] = useState<PresentationPropertyDataProvider | undefined>(undefined);
  const [currentPropertyList, setCurrentPropertyList] = useState<PropertyRecord[]>([]);
  const [selectionKeySet, setSelectionKeyset] = useState<KeySet>(new KeySet());
  const [queryBuilder, setQueryBuilder] = useState<QueryBuilder | undefined>();

  useEffect(() => {
    const onSelectionChanged = async (evt: SelectionChangeEventArgs, selectionProvider: ISelectionProvider) => {
      const selection = selectionProvider.getSelection(evt.imodel, evt.level);
      const keys = new KeySet(selection);
      setSelectionKeyset(keys);
      const dataProvider = await createPropertyDataProvider(keys, iModelConnection);
      setDataProvider(dataProvider);
      setQueryBuilder(new QueryBuilder(dataProvider, iModelConnection));
    };

    return iModelConnection ? Presentation.selection.selectionChange.addListener(onSelectionChanged) : () => {};
  }, [iModelConnection]);

  const onClickResetButton = async () => {
    queryBuilder?.resetQueryBuilder();
    updateQuery("");
    if (currentPropertyList.length > 0) {
      setCurrentPropertyList([]);
    } else if (iModelConnection) {
      Presentation.selection.clearSelection("GroupQueryBuilderCustomUI", iModelConnection);
    }
    if (resetView)
      await resetView().catch((e) =>
        /* eslint-disable no-console */
        console.error(e),
      );
  };

  const resize = useCallback((width, height) => setSize({ width, height }), []);

  const propertyContextValues = useMemo(
    () => ({
      currentPropertyList,
      setCurrentPropertyList,
      queryBuilder,
      setQuery: updateQuery,
      isUpdating: isUpdating ?? false,
    }),
    [currentPropertyList, isUpdating, queryBuilder, updateQuery],
  );

  const actionButtonRenderers = useMemo(() => [({ property }: ActionButtonRendererProps) => <PropertyAction property={property} />], []);

  return (
    <div className="gmw-select-query-generator-container">
      {!dataProvider || selectionKeySet.size === 0 ? (
        <Alert type="informational">Please select on an element within the viewer first, then select properties to generate a group query.</Alert>
      ) : (
        <>
          <div className="gmw-select-property-grid-container">
            <ResizableContainerObserver onResize={resize} />
            <PropertyGridWrapperContext.Provider value={propertyContextValues}>
              <VirtualizedPropertyGridWithDataProvider
                dataProvider={dataProvider}
                width={size.width}
                height={size.height}
                actionButtonRenderers={actionButtonRenderers}
              />
            </PropertyGridWrapperContext.Provider>
          </div>
          <div className="gmw-select-reset-button">
            <Button styleType="default" size="small" onClick={onClickResetButton}>
              Reset
            </Button>
          </div>
        </>
      )}
    </div>
  );
};
