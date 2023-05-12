/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import "./PropertyGrid.scss";
import { useCallback } from "react";
import { PropertyValueFormat } from "@itwin/appui-abstract";
import {
  FilteredType, FilteringPropertyDataProvider, PropertyDataChangeEvent, PropertyRecordDataFiltererBase, VirtualizedPropertyGridWithDataProvider,
} from "@itwin/components-react";
import { useDisposable } from "@itwin/core-react";

import type { PropertyRecord } from "@itwin/appui-abstract";
import type { IPropertyDataProvider, PropertyCategory, PropertyData , PropertyDataFiltererBase, PropertyDataFilterResult, VirtualizedPropertyGridWithDataProviderProps } from "@itwin/components-react";
import type { IDisposable } from "@itwin/core-bentley";

/**
 * Properties for rendering a `FilteringPropertyGrid`
 */
export interface FilteringPropertyGridProps extends VirtualizedPropertyGridWithDataProviderProps {
  filterer: PropertyDataFiltererBase;
  autoExpandChildCategories?: boolean;
}

/**
 * Creates a filtered data provider before rendering a `VirtualizedPropertyGridWithDataProvider`
 */
export function FilteringPropertyGrid({ filterer, dataProvider, autoExpandChildCategories, ...props }: FilteringPropertyGridProps) {
  const filteringDataProvider = useDisposable(useCallback(
    () => {
      const filteringProvider = new FilteringPropertyDataProvider(dataProvider, filterer);
      return new AutoExpandingPropertyFilterDataProvider(filteringProvider, autoExpandChildCategories);
    },
    [filterer, dataProvider, autoExpandChildCategories]
  ));

  return (
    <>
      <VirtualizedPropertyGridWithDataProvider
        {...props}
        minLabelWidth={10}
        minValueWidth={10}
        actionButtonWidth={props.actionButtonWidth ?? props.actionButtonRenderers ? undefined : 0}
        dataProvider={filteringDataProvider}
      />
    </>
  );
}

/**
 * Placeholder filter
 */
export class NoopPropertyDataFilterer extends PropertyRecordDataFiltererBase {
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

class AutoExpandingPropertyFilterDataProvider implements IPropertyDataProvider, IDisposable {
  public onDataChanged = new PropertyDataChangeEvent();
  private _removeListener: () => void;
  private _autoExpandChildCategories = true;

  constructor(
    private _wrapped: FilteringPropertyDataProvider,
    autoExpandChildCategories?: boolean,
  ) {
    this._removeListener = this._wrapped.onDataChanged.addListener(() => this.onDataChanged.raiseEvent());
    if (undefined !== autoExpandChildCategories) {
      this._autoExpandChildCategories = autoExpandChildCategories;
    }
  }

  public dispose() {
    this._removeListener();
    this._wrapped.dispose();
  }

  public async getData(): Promise<PropertyData> {
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
