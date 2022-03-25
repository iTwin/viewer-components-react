/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import "./PropertyGrid.scss";
import type { IDisposable } from "@itwin/core-bentley";
import type {
  IPresentationPropertyDataProvider,
} from "@itwin/presentation-components";
import {
  usePropertyDataProviderWithUnifiedSelection,
} from "@itwin/presentation-components";
import type { PropertyRecord } from "@itwin/appui-abstract";
import { PropertyValueFormat } from "@itwin/appui-abstract";
import type {
  IPropertyDataProvider,
  PropertyCategory,
  PropertyData,
  PropertyDataFiltererBase,
  PropertyDataFilterResult,
  VirtualizedPropertyGridWithDataProviderProps,
} from "@itwin/components-react";
import {
  FilteredType,
  FilteringPropertyDataProvider,
  PropertyDataChangeEvent,
  PropertyRecordDataFiltererBase,
  VirtualizedPropertyGridWithDataProvider,
} from "@itwin/components-react";
import { FillCentered, useDisposable } from "@itwin/core-react";

import { PropertyGridManager } from "../PropertyGridManager";
import React, { useCallback, useMemo } from "react";

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
class AutoExpandingPropertyFilterDataProvider<TPropertyData extends PropertyData>
implements IPropertyDataProvider, IDisposable {
  public onDataChanged = new PropertyDataChangeEvent();
  private _removeListener: () => void;

  public constructor(
    private _wrapped: CustomPropertyDataProvider<TPropertyData>
  ) {
    this._removeListener = this._wrapped.onDataChanged.addListener(() =>
      this.onDataChanged.raiseEvent()
    );
  }

  public dispose() {
    this._removeListener();
    this._wrapped.dispose();
  }

  public async getData(): Promise<TPropertyData> {
    function expandCategories(categories: PropertyCategory[]) {
      categories.forEach((category: PropertyCategory) => {
        category.expand = true;
        if (category.childCategories) {
          expandCategories(category.childCategories);
        }
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

export const FilteringPropertyGridWithUnifiedSelection = (
  props: FilteringPropertyGrid
) => {
  const localizations = useMemo(() => ({
    tooManySelected: PropertyGridManager.translate(
      "context-menu.selection.too-many-elements-selected"
    ),
    noneSelected: PropertyGridManager.translate(
      "context-menu.selection.no-elements-selected"
    ),
  }), []);

  const { isOverLimit } = usePropertyDataProviderWithUnifiedSelection({ dataProvider: props.dataProvider as IPresentationPropertyDataProvider });

  const filteringDataProvider = useDisposable(useCallback(
    () => new FilteringPropertyDataProvider(
      props.dataProvider,
      props.filterer
    ),
    [props.dataProvider, props.filterer]
  ));

  const autoExpandingFilteringDataProvider = useDisposable(useCallback(
    () => new AutoExpandingPropertyFilterDataProvider(filteringDataProvider),
    [filteringDataProvider],
  ));

  return (
    <>
      {isOverLimit ? (
        <FillCentered style={{ flexDirection: "column" }}>
          <div className="property-grid-react-filtering-pg-label">
            { localizations.tooManySelected }
          </div>
        </FillCentered>
      ) : (
        <VirtualizedPropertyGridWithDataProvider
          {...props}
          dataProvider={autoExpandingFilteringDataProvider}
        />
      )}
    </>
  );
};
