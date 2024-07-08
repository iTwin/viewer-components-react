/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { useCallback, useEffect, useState } from "react";
import { PropertyValueFormat } from "@itwin/appui-abstract";
import {
  FilteredType, FilteringPropertyDataProvider, PropertyDataChangeEvent, PropertyRecordDataFiltererBase, useDebouncedAsyncValue,
  VirtualizedPropertyGridWithDataProvider,
} from "@itwin/components-react";
import { FillCentered } from "@itwin/core-react";
import { Text } from "@itwin/itwinui-react";
import { PropertyGridManager } from "../PropertyGridManager";

import type { PropertyRecord } from "@itwin/appui-abstract";
import type {
  FilteredPropertyData,
  IPropertyDataFilterer,
  IPropertyDataProvider,
  PropertyCategory,
  PropertyData,
  PropertyDataFilterResult,
  VirtualizedPropertyGridWithDataProviderProps,
} from "@itwin/components-react";
import type { IDisposable } from "@itwin/core-bentley";

/**
 * Properties for rendering a `FilteringPropertyGrid`.
 * @public
 */
export interface FilteringPropertyGridProps extends VirtualizedPropertyGridWithDataProviderProps {
  /** Specifies whether child categories should be auto expanded or not. */
  autoExpandChildCategories?: boolean;
  /** Filterer used to filter data. */
  filterer: IPropertyDataFilterer;
}

/**
 * Creates a filtered data provider before rendering a `VirtualizedPropertyGridWithDataProvider`.
 * @internal
 */
export function FilteringPropertyGrid({ filterer, dataProvider, autoExpandChildCategories, ...props }: FilteringPropertyGridProps) {
  const [filteringDataProvider, setFilteringDataProvider] = useState<AutoExpandingPropertyFilterDataProvider>();
  useEffect(() => {
    const filteringProvider = new FilteringPropertyDataProvider(dataProvider, filterer);
    const provider = new AutoExpandingPropertyFilterDataProvider(filteringProvider, autoExpandChildCategories);
    setFilteringDataProvider(provider);
    return () => {
      provider.dispose();
    };
  }, [filterer, dataProvider, autoExpandChildCategories]);

  const { value: filterMatchesCount, inProgress: isFiltering } = useDebouncedAsyncValue(
    useCallback(async () => {
      const filteredData = (await filteringDataProvider?.getData()) as FilteredPropertyData;
      return filteredData?.matchesCount;
    }, [filteringDataProvider]),
  );

  if (!filteringDataProvider) {
    return null;
  }

  // in order to allow resize values column fully we need to override default width reserved for action buttons.
  // istanbul ignore next
  const actionButtonWidth = props.actionButtonWidth !== undefined ? props.actionButtonWidth : props.actionButtonRenderers !== undefined ? undefined : 0;

  if (!isFiltering && filterMatchesCount === 0) {
    return (
      <FillCentered style={{ flexDirection: "column" }}>
        <Text>
          {props.highlight?.highlightedText
            ? PropertyGridManager.translate("filtering.no-matching-properties", { filter: props.highlight.highlightedText })
            : PropertyGridManager.translate("filtering.no-non-null-values")}
        </Text>
      </FillCentered>
    );
  }

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
        matchesCount: 0,
      };
    }

    return {
      filteredTypes: [FilteredType.Value],
      matchesFilter: !!node.value.displayValue,
      matchesCount: node.value.displayValue ? 1 : 0,
    };
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
    // istanbul ignore next
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
