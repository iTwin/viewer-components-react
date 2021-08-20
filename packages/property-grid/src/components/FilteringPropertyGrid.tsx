/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import * as React from "react";

import {
  FilteredType,
  FilteringPropertyDataProvider,
  IPropertyDataProvider,
  PropertyCategory,
  PropertyData,
  PropertyDataChangeEvent,
  PropertyDataFiltererBase,
  PropertyDataFilterResult,
  PropertyRecordDataFiltererBase,
  VirtualizedPropertyGridWithDataProvider,
  VirtualizedPropertyGridWithDataProviderProps,
} from "@bentley/ui-components";
import {
  IPresentationPropertyDataProvider,
  usePropertyDataProviderWithUnifiedSelection,
} from "@bentley/presentation-components";
import { FillCentered } from "@bentley/ui-core";
import { IModelApp } from "@bentley/imodeljs-frontend";
import { IDisposable } from "@bentley/bentleyjs-core";
import { PropertyRecord, PropertyValueFormat } from "@bentley/ui-abstract";

export class PlaceholderPropertyDataFilterer extends PropertyRecordDataFiltererBase {
  public get isActive() {
    return false;
  }
  public async recordMatchesFilter(): Promise<PropertyDataFilterResult> {
    return { matchesFilter: true };
  }
}

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
class AutoExpandingPropertyDataProvider<TPropertyData extends PropertyData>
  implements IPropertyDataProvider, IDisposable
{
  public onDataChanged = new PropertyDataChangeEvent();
  public constructor(
    private _wrapped: CustomPropertyDataProvider<TPropertyData>
  ) {
    this._wrapped.onDataChanged.addListener(() =>
      this.onDataChanged.raiseEvent()
    );
  }
  public dispose() {
    this._wrapped.dispose();
  }
  public async getData(): Promise<TPropertyData> {
    function expandCategories(categories: PropertyCategory[]) {
      categories.forEach((category: PropertyCategory) => {
        category.expand = true;
        if (category.childCategories)
          expandCategories(category.childCategories);
      });
    }
    const result = await this._wrapped.getData();
    expandCategories(result.categories);
    return result;
  }
}

interface FilteringPropertyGrid
  extends VirtualizedPropertyGridWithDataProviderProps {
  filterer: PropertyDataFiltererBase;
}

export function FilteringPropertyGridWithUnifiedSelection(
  props: FilteringPropertyGrid
): JSX.Element {
  // numSelectedElements will return undefined until presentation-components 2.17.x
  const { isOverLimit, numSelectedElements } = (
    usePropertyDataProviderWithUnifiedSelection as any
  )({ dataProvider: props.dataProvider as IPresentationPropertyDataProvider });

  const filteringDataProvider = React.useMemo(() => {
    return new FilteringPropertyDataProvider(
      props.dataProvider,
      props.filterer
    );
  }, [props.dataProvider, props.filterer]);

  const autoExpandingFilteringDataProvider = React.useMemo(() => {
    return new AutoExpandingPropertyDataProvider(filteringDataProvider);
  }, [filteringDataProvider]);

  if (isOverLimit) {
    return (
      <FillCentered>
        {IModelApp.i18n.translate(
          "PropertyGrid:selection.too-many-elements-selected"
        )}
      </FillCentered>
    );
  }
  if (numSelectedElements !== undefined && numSelectedElements === 0) {
    return (
      <FillCentered>
        {IModelApp.i18n.translate(
          "PropertyGrid:selection.no-elements-selected"
        )}
      </FillCentered>
    );
  }
  return (
    <VirtualizedPropertyGridWithDataProvider
      {...props}
      dataProvider={autoExpandingFilteringDataProvider}
    />
  );
}
