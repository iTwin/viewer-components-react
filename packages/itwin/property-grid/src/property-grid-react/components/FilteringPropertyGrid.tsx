/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { useEffect, useState } from "react";
import { PropertyRecord, PropertyValueFormat } from "@itwin/appui-abstract";
import {
  FilteredType,
  FilteringPropertyDataProvider,
  PropertyDataChangeEvent,
  PropertyRecordDataFiltererBase,
  usePropertyData,
  VirtualizedPropertyGridWithDataProvider,
} from "@itwin/components-react";
import { BeEvent } from "@itwin/core-bentley";
import { Flex, Text } from "@itwin/itwinui-react";
import { PropertyGridManager } from "../PropertyGridManager.js";

import type { IDisposable } from "@itwin/core-bentley";
import type {
  FilteredPropertyData,
  IPropertyDataFilterer,
  IPropertyDataProvider,
  PropertyCategory,
  PropertyData,
  PropertyDataFilterResult,
} from "@itwin/components-react";
/**
 * Properties for rendering a `FilteringPropertyGrid`.
 * @public
 */
export interface FilteringPropertyGridProps extends React.ComponentProps<typeof VirtualizedPropertyGridWithDataProvider> {
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

  const { value: propertyData, inProgress: isFiltering } = usePropertyData({
    dataProvider: filteringDataProvider ?? emptyDataProvider,
  });

  if (!filteringDataProvider) {
    return null;
  }

  // in order to allow resize values column fully we need to override default width reserved for action buttons.
  const actionButtonWidth =
    props.actionButtonWidth !== undefined ? /* c8 ignore next */ props.actionButtonWidth : props.actionButtonRenderers !== undefined ? undefined : 0;

  const filterMatchesCount = (propertyData as FilteredPropertyData | undefined)?.matchesCount;
  if (!isFiltering && filterMatchesCount === 0) {
    return (
      <Flex justifyContent="center" alignItems="center" flexDirection="column" style={{ width: "100%", height: "100%" }}>
        <Text>
          {props.highlight?.highlightedText
            ? PropertyGridManager.translate("filtering.no-matching-properties", { filter: props.highlight.highlightedText })
            : PropertyGridManager.translate("filtering.no-non-null-values")}
        </Text>
      </Flex>
    );
  }

  return (
    <VirtualizedPropertyGridWithDataProvider
      {...props}
      minLabelWidth={10}
      minValueWidth={10}
      actionButtonWidth={actionButtonWidth}
      dataProvider={filteringDataProvider}
    />
  );
}

const emptyDataProvider: IPropertyDataProvider = {
  getData: /* c8 ignore next */ async () => emptyPropertyData,
  onDataChanged: new BeEvent(),
};
const emptyPropertyData: PropertyData = {
  label: PropertyRecord.fromString(""),
  categories: [],
  records: {},
};

/**
 * Filterer that does nothing.
 * @internal
 */
export class NoopPropertyDataFilterer extends PropertyRecordDataFiltererBase {
  public get isActive() {
    return false;
  }
  /* c8 ignore next 3 */
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
    /* c8 ignore next*/
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
