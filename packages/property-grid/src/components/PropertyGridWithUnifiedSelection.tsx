/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/


import * as React from "react";

import {
  FilteringPropertyDataProvider,
  IPropertyDataProvider,
  PropertyCategory,
  PropertyData,
  PropertyDataChangeEvent,
  PropertyDataFiltererBase,
  VirtualizedPropertyGridWithDataProvider,
  VirtualizedPropertyGridWithDataProviderProps,
} from "@bentley/ui-components";
import { IPresentationPropertyDataProvider, usePropertyDataProviderWithUnifiedSelection } from "@bentley/presentation-components";
import { FillCentered } from "@bentley/ui-core";
import { IModelApp } from "@bentley/imodeljs-frontend";
import { IDisposable } from "@bentley/bentleyjs-core";

type CustomPropertyDataProvider<TPropertyData> = IDisposable & Omit<IPropertyDataProvider, "getData"> & { getData: () => Promise<TPropertyData> };
class AutoExpandingPropertyDataProvider<TPropertyData extends PropertyData> implements IPropertyDataProvider, IDisposable {
  public onDataChanged = new PropertyDataChangeEvent();
  public constructor(private _wrapped: CustomPropertyDataProvider<TPropertyData>) {
    this._wrapped.onDataChanged.addListener(() => this.onDataChanged.raiseEvent());
  }
  public dispose() { this._wrapped.dispose(); }
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

interface PropertyGridWithUnifiedSelectionProps extends VirtualizedPropertyGridWithDataProviderProps {
  filterer: PropertyDataFiltererBase;
}

export function PropertyGridWithUnifiedSelection(props: PropertyGridWithUnifiedSelectionProps): JSX.Element {
  const { isOverLimit , numSelectedElements } = (usePropertyDataProviderWithUnifiedSelection as any) (
    { dataProvider: props.dataProvider as IPresentationPropertyDataProvider },
  );
  const filteringDataProvider = new FilteringPropertyDataProvider(props.dataProvider, props.filterer);
  const autoExpandingFilteringDataProvider = new AutoExpandingPropertyDataProvider(filteringDataProvider);
  if (isOverLimit) {
    return (
      <FillCentered>
        {IModelApp.i18n.translate("Sample:property-grid.too-many-elements-selected")}
      </FillCentered>
    );
  }
  if (numSelectedElements !== undefined && numSelectedElements === 0) {
    return (
      <FillCentered>
        {IModelApp.i18n.translate("Sample:property-grid.no-elements-selected")}
      </FillCentered>
    );
  }
  return <VirtualizedPropertyGridWithDataProvider {...props} dataProvider={autoExpandingFilteringDataProvider} />;
}
