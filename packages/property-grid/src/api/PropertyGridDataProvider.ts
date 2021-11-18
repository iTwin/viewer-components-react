/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
import { IModelConnection } from "@itwin/core-frontend";
import { Field } from "@itwin/presentation-common";
import { PresentationPropertyDataProvider } from "@itwin/presentation-components";
import { PropertyCategory, PropertyData } from "@itwin/components-react";
export class PropertyDataProvider extends PresentationPropertyDataProvider {
  // tslint:disable-next-line:naming-convention
  private _parentIsFieldFavorite = this.isFieldFavorite;

  // tslint:disable-next-line:naming-convention
  protected override isFieldFavorite = (field: Field): boolean =>
    this._enableFavoriteProperties ? this._parentIsFieldFavorite(field) : false;

  private _enableFavoriteProperties: boolean;

  constructor(
    iModelConnection: IModelConnection,
    rulesetId?: string,
    enableFavoriteProperties?: boolean
  ) {
    super({ imodel: iModelConnection, ruleset: rulesetId });
    this.pagingSize = 50;
    this._enableFavoriteProperties = enableFavoriteProperties ?? false;
  }

  /** Expand categories by default */
  public override async getData(): Promise<PropertyData> {
    const data = await super.getData();
    const newCategories = data.categories.map((value: PropertyCategory) => {
      return { ...value, expand: true };
    });
    data.categories = newCategories;
    return data;
  }
}
