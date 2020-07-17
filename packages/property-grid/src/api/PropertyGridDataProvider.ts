/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { IModelConnection } from "@bentley/imodeljs-frontend";
import { Field } from "@bentley/presentation-common";
import { PropertyCategory, PropertyData } from "@bentley/ui-components";
import { PresentationPropertyDataProvider } from "@bentley/presentation-components";
export class PropertyDataProvider extends PresentationPropertyDataProvider {
  // tslint:disable-next-line:naming-convention
  protected isFieldFavorite = (field: Field): boolean =>
    this._enableFavoriteProperties ? this._parentIsFieldFavorite(field) : false

  private _parentIsFieldFavorite = this.isFieldFavorite;
  private _enableFavoriteProperties: boolean;

  constructor(
    iModelConnection: IModelConnection,
    rulesetId?: string,
    enableFavoriteProperties?: boolean,
  ) {
    super({ imodel: iModelConnection, ruleset: rulesetId });
    this.pagingSize = 50;
    this._enableFavoriteProperties = enableFavoriteProperties ?? false;
  }

  /** Expand categories by default */
  public async getData(): Promise<PropertyData> {
    const data = await super.getData();
    const newCategories = data.categories.map((value: PropertyCategory) => {
      return { ...value, expand: true };
    });
    data.categories = newCategories;
    return data;
  }
}
