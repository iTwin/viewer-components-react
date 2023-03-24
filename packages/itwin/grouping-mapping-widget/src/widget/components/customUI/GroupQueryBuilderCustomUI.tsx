/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useActiveIModelConnection } from "@itwin/appui-react";
import { Presentation } from "@itwin/presentation-frontend";
import type {
  ISelectionProvider,
  SelectionChangeEventArgs,
} from "@itwin/presentation-frontend";
import { KeySet } from "@itwin/presentation-common";
import "./GroupQueryBuilderCustomUI.scss";
import { QueryBuilder } from "../QueryBuilder";
import type { GroupingCustomUIProps } from "./GroupingMappingCustomUI";
import {
  DEFAULT_PROPERTY_GRID_RULESET,
  PresentationPropertyDataProvider,
} from "@itwin/presentation-components";
import type { IModelConnection } from "@itwin/core-frontend";
import type { ActionButtonRendererProps } from "@itwin/components-react";
import { VirtualizedPropertyGridWithDataProvider } from "@itwin/components-react";
import { ResizableContainerObserver } from "@itwin/core-react";
import type { PropertyRecord } from "@itwin/appui-abstract";
import { PropertyGridWrapperContext } from "../context/PropertyGridWrapperContext";
import { PropertyAction } from "../PropertyAction";
import { Button, Text } from "@itwin/itwinui-react";

const createPropertyDataProvider = (
  keys: KeySet,
  iModelConnection: IModelConnection
): PresentationPropertyDataProvider => {
  const dataProvider = new PresentationPropertyDataProvider({
    imodel: iModelConnection,
    ruleset: DEFAULT_PROPERTY_GRID_RULESET,
  });
  dataProvider.keys = keys;
  dataProvider.isNestedPropertyCategoryGroupingEnabled = true;
  return dataProvider;
};

interface ContainerDimensions {
  width: number;
  height: number;
}

export const GroupQueryBuilderCustomUI = ({
  updateQuery,
  isUpdating,
  resetView,
}: GroupingCustomUIProps) => {
  const iModelConnection = useActiveIModelConnection();
  if (!iModelConnection) {
    throw new Error("This component requires an active iModelConnection.");
  }
  const [size, setSize] = useState<ContainerDimensions>({ width: 0, height: 0 });
  const [dataProvider, setDataProvider] =
    useState<PresentationPropertyDataProvider | undefined>(undefined);
  const [currentPropertyList, setCurrentPropertyList] = useState<PropertyRecord[]>([]);
  const [selectionKeySet, setSelectionKeyset] = useState<KeySet>(new KeySet());
  const [queryBuilder, setQueryBuilder] = useState<QueryBuilder | undefined>();

  useEffect(() => {
    const onSelectionChanged = async (
      evt: SelectionChangeEventArgs,
      selectionProvider: ISelectionProvider
    ) => {
      const selection = selectionProvider.getSelection(evt.imodel, evt.level);
      const keys = new KeySet(selection);
      setSelectionKeyset(keys);
      const dataProvider = createPropertyDataProvider(keys, iModelConnection);
      setDataProvider(dataProvider);
      setQueryBuilder(new QueryBuilder(dataProvider));
    };

    return iModelConnection
      ? Presentation.selection.selectionChange.addListener(onSelectionChanged)
      : () => { };
  }, [iModelConnection]);

  const onClickResetButton = async () => {
    queryBuilder?.resetQuery();
    updateQuery("");
    setCurrentPropertyList([]);
    if (resetView)
      await resetView().catch((e) =>
        /* eslint-disable no-console */
        console.error(e)
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
    [currentPropertyList, isUpdating, queryBuilder, updateQuery]
  );

  const actionButtonRenderers = useMemo(
    () => [
      ({ property }: ActionButtonRendererProps) => (
        <PropertyAction property={property} />
      ),
    ],
    []
  );

  return (
    <div className="gmw-select-query-generator-container">
      {!dataProvider || selectionKeySet.size === 0 ? (
        <div className="gmw-select-element-hint">
          <Text>No elements have been selected.</Text>
        </div>
      ) :
        <>
          <div className="gmw-select-property-grid-container">
            <div className="gmw-select-property-grid">
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
          </div>
          <div className="gmw-select-reset-button">
            <Button
              styleType="default"
              size="small"
              onClick={onClickResetButton}
            >
              Reset
            </Button>
          </div>
        </>
      }
    </div>
  );
};

