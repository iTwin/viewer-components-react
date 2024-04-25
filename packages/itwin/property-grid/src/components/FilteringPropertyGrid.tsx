/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { useEffect, useState } from "react";
import { PropertyValueFormat } from "@itwin/appui-abstract";
import {
  FilteredType,
  FilteringPropertyDataProvider,
  PropertyDataChangeEvent,
  PropertyRecordDataFiltererBase,
  VirtualizedPropertyGridWithDataProvider,
} from "@itwin/components-react";

import type { PropertyRecord } from "@itwin/appui-abstract";
import type {
  IPropertyDataFilterer,
  IPropertyDataProvider,
  PropertyCategory,
  PropertyData,
  PropertyDataFilterResult,
  VirtualizedPropertyGridWithDataProviderProps,
} from "@itwin/components-react";
import type { IDisposable } from "@itwin/core-bentley";
import { useLatest } from "../hooks/UseLatest";

/**
 * Properties for rendering a `FilteringPropertyGrid`.
 * @public
 */
export interface FilteringPropertyGridProps extends VirtualizedPropertyGridWithDataProviderProps {
  /** Specifies whether child categories should be auto expanded or not. */
  autoExpandChildCategories?: boolean;
  /** @internal */
  filterer: IPropertyDataFilterer;
  /** Callback called when property data is loaded. */
  onDataLoaded?: () => void;
}

/**
 * Creates a filtered data provider before rendering a `VirtualizedPropertyGridWithDataProvider`.
 * @internal
 */
export function FilteringPropertyGrid({ filterer, dataProvider, autoExpandChildCategories, onDataLoaded, ...props }: FilteringPropertyGridProps) {
  const [filteringDataProvider, setFilteringDataProvider] = useState<AutoExpandingPropertyFilterDataProvider>();
  const onDataLoadedRef = useLatest(onDataLoaded);
  useEffect(() => {
    const filteringProvider = new FilteringPropertyDataProvider(dataProvider, filterer);
    const provider = new AutoExpandingPropertyFilterDataProvider(filteringProvider, autoExpandChildCategories, onDataLoadedRef.current);
    setFilteringDataProvider(provider);
    return () => {
      provider.dispose();
    };
  }, [filterer, dataProvider, autoExpandChildCategories, onDataLoadedRef]);

  if (!filteringDataProvider) {
    return null;
  }

  // in order to allow resize values column fully we need to override default width reserved for action buttons.
  // istanbul ignore next
  const actionButtonWidth = props.actionButtonWidth !== undefined ? props.actionButtonWidth : props.actionButtonRenderers !== undefined ? undefined : 0;

  return (
    <>
      <VirtualizedPropertyGridWithDataProvider
        {...props}
        minLabelWidth={10}
        minValueWidth={10}
        actionButtonWidth={actionButtonWidth}
        dataProvider={filteringDataProvider}
      />
    </>
  );
}

/**
 * Filterer that does nothing.
 * @internal
 */
export class NoopPropertyDataFilterer extends PropertyRecordDataFiltererBase {
  public get isActive() {
    return false;
  }
  // istanbul ignore next
  public async recordMatchesFilter(): Promise<PropertyDataFilterResult> {
    return { matchesFilter: true };
  }
}

/**
 * Filter that hides empty property data.
 * @internal
 */
export class NonEmptyValuesPropertyDataFilterer extends PropertyRecordDataFiltererBase {
  public get isActive() {
    return true;
  }
  public async recordMatchesFilter(node: PropertyRecord): Promise<PropertyDataFilterResult> {
    if (node.value.valueFormat !== PropertyValueFormat.Primitive) {
      return {
        matchesFilter: false,
      };
    }

    return {
      filteredTypes: [FilteredType.Value],
      matchesFilter: !!node.value.displayValue,
    };
  }
}

class AutoExpandingPropertyFilterDataProvider implements IPropertyDataProvider, IDisposable {
  public onDataChanged = new PropertyDataChangeEvent();
  private _removeListener: () => void;
  private _autoExpandChildCategories = true;
  private _onDataLoaded?: () => void;

  constructor(
    private _wrapped: FilteringPropertyDataProvider,
    autoExpandChildCategories?: boolean,
    onDataLoaded?: () => void,
  ) {
    // istanbul ignore next
    this._removeListener = this._wrapped.onDataChanged.addListener(() => this.onDataChanged.raiseEvent());
    this._onDataLoaded = onDataLoaded;
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
    this._onDataLoaded?.();
    return result;
  }
}
