/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import "./PropertyGrid.scss";
import React, { useCallback, useMemo } from "react";
import { PropertyValueFormat } from "@itwin/appui-abstract";
import {
  FilteredType, FilteringPropertyDataProvider, PropertyDataChangeEvent, PropertyRecordDataFiltererBase, VirtualizedPropertyGridWithDataProvider,
} from "@itwin/components-react";
import { FillCentered, useDisposable } from "@itwin/core-react";
import { usePropertyDataProviderWithUnifiedSelection } from "@itwin/presentation-components";
import { PropertyGridManager } from "../PropertyGridManager";

import type { IDisposable } from "@itwin/core-bentley";
import type {
  IPresentationPropertyDataProvider,
} from "@itwin/presentation-components";
import type { PropertyRecord } from "@itwin/appui-abstract";
import type {
  IPropertyDataProvider,
  PropertyCategory,
  PropertyData,
  PropertyDataFiltererBase,
  PropertyDataFilterResult,
  VirtualizedPropertyGridWithDataProviderProps,
} from "@itwin/components-react";

/**
 * Placeholder filter
 */
export class PlaceholderPropertyDataFilterer extends PropertyRecordDataFiltererBase {
  public get isActive() {
    return false;
  }
  public async recordMatchesFilter(): Promise<PropertyDataFilterResult> {
    return { matchesFilter: true };
  }
}

/**
 * Filter that hides empty property data
 */
export class NonEmptyValuesPropertyDataFilterer extends PropertyRecordDataFiltererBase {
  public get isActive() {
    return true;
  }
  public async recordMatchesFilter(
    node: PropertyRecord
  ): Promise<PropertyDataFilterResult> {
    if (node.value.valueFormat === PropertyValueFormat.Primitive) {
      return {
        filteredTypes: [FilteredType.Value],
        matchesFilter: !!node.value.displayValue,
      };
    }
    if (node.value.valueFormat === PropertyValueFormat.Array) {
      return {
        filteredTypes: [FilteredType.Value],
        matchesFilter: node.value.items.length > 0,
      };
    }
    if (node.value.valueFormat === PropertyValueFormat.Struct) {
      return {
        filteredTypes: [FilteredType.Value],
        matchesFilter: Object.keys(node.value.members).length > 0,
      };
    }
    return { matchesFilter: false };
  }
}

type CustomPropertyDataProvider<TPropertyData> = IDisposable &
Omit<IPropertyDataProvider, "getData"> & {
  getData: () => Promise<TPropertyData>;
};

class AutoExpandingPropertyFilterDataProvider<TPropertyData extends PropertyData> implements IPropertyDataProvider, IDisposable {
  public onDataChanged = new PropertyDataChangeEvent();
  private _removeListener: () => void;
  private _autoExpandChildCategories = true;
  public constructor(
    private _wrapped: CustomPropertyDataProvider<TPropertyData>,
    autoExpandChildCategories?: boolean,
  ) {
    this._removeListener = this._wrapped.onDataChanged.addListener(() =>
      this.onDataChanged.raiseEvent()
    );
    if (undefined !== autoExpandChildCategories) {
      this._autoExpandChildCategories = autoExpandChildCategories;
    }
  }

  public dispose() {
    this._removeListener();
    this._wrapped.dispose();
  }

  public async getData(): Promise<TPropertyData> {
    const autoExpandChildCategories = this._autoExpandChildCategories;
    function expandCategories(categories: PropertyCategory[]) {
      categories.forEach((category: PropertyCategory) => {
        category.expand = true;
        if (category.childCategories && autoExpandChildCategories) {
          expandCategories(category.childCategories);
        }
      });
    }
    const result = await this._wrapped.getData();
    expandCategories(result.categories);
    return result;
  }
}

/**
 * Properties for rendering a `FilteringPropertyGrid`
 */
interface FilteringPropertyGridProps
  extends VirtualizedPropertyGridWithDataProviderProps {
  filterer: PropertyDataFiltererBase;
  autoExpandChildCategories?: boolean;
}

/**
 * Calls the `usePropertyDataProviderWithUnifiedSelection` hook before rendering a `FilteringPropertyGrid`
 */
export const FilteringPropertyGridWithUnifiedSelection = (
  props: FilteringPropertyGridProps
) => {
  const localizations = useMemo(() => ({
    tooManySelected: PropertyGridManager.translate(
      "context-menu.selection.too-many-elements-selected"
    ),
  }), []);

  const { isOverLimit } = usePropertyDataProviderWithUnifiedSelection({ dataProvider: props.dataProvider as IPresentationPropertyDataProvider });

  return (
    <>
      {isOverLimit ? (
        <FillCentered style={{ flexDirection: "column" }}>
          <div className="property-grid-react-filtering-pg-label">
            { localizations.tooManySelected }
          </div>
        </FillCentered>
      ) : (
        <FilteringPropertyGrid
          {...props}
        />
      )}
    </>
  );
};

/**
 * Creates a filtered data provider before rendering a `VirtualizedPropertyGridWithDataProvider`
 */
export const FilteringPropertyGrid = (
  props: FilteringPropertyGridProps
) => {

  const filteringDataProvider = useDisposable(useCallback(
    () => new FilteringPropertyDataProvider(
      props.dataProvider,
      props.filterer
    ),
    [props.dataProvider, props.filterer]
  ));

  const autoExpandingFilteringDataProvider = useDisposable(useCallback(
    () => new AutoExpandingPropertyFilterDataProvider(filteringDataProvider, props.autoExpandChildCategories),
    [props.autoExpandChildCategories, filteringDataProvider],
  ));

  return (
    <>
      <VirtualizedPropertyGridWithDataProvider
        {...props}
        dataProvider={autoExpandingFilteringDataProvider}
      />
    </>
  );
};
