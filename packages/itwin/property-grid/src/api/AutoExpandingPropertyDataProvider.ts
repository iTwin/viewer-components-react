/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { PresentationPropertyDataProvider } from "@itwin/presentation-components";

import type { PresentationPropertyDataProviderProps } from "@itwin/presentation-components";
import type { PropertyCategory, PropertyData } from "@itwin/components-react";

export interface AutoExpandingPropertyDataProviderProps extends PresentationPropertyDataProviderProps {
  autoExpandChildCategories?: boolean;
}

export class AutoExpandingPropertyDataProvider extends PresentationPropertyDataProvider {
  private _autoExpandChildCategories = true;
  constructor(props: AutoExpandingPropertyDataProviderProps) {
    super(props);
    if (undefined !== props.autoExpandChildCategories) {
      this._autoExpandChildCategories = props.autoExpandChildCategories;
    }
  }

  public override async getData(): Promise<PropertyData> {
    const result = await super.getData();
    this.expandCategories(result.categories);
    return result;
  }

  private expandCategories(categories: PropertyCategory[]) {
    categories.forEach((category: PropertyCategory) => {
      category.expand = true;
      if (category.childCategories && this._autoExpandChildCategories) {
        this.expandCategories(category.childCategories);
      }
    });
  }
}
