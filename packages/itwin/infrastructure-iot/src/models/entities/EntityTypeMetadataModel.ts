/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

export class EntityTypeMetadata {

  private readonly id?: string;
  private readonly name?: string;
  private readonly icon?: string;
  private readonly iconUnicode?: string;

  private readonly editableProps?: string[];
  private readonly categories?: string[];
  private readonly defaultMetrics?: {id: string, unit: string}[];

  private readonly manufacturer?: string;
  private readonly manufacturerLogoUrl?: string;
  private readonly minThreadVersion?: string;

  private readonly editOnly?: boolean;
  private readonly isDynamic?: boolean;

  private readonly description?: string;
  private readonly imageUrl?: string;

  public getId(): string | undefined {
    return this.id;
  }

  public getName(): string | undefined  {
    return this.name;
  }

  public getIcon(): string | undefined  {
    return this.icon;
  }

  public getIconUnicode(): string | undefined  {
    return this.iconUnicode;
  }

  public getEditableProps(): string[] {
    return this.editableProps || [];
  }

  public canEditProp(prop: string): boolean {
    return (this.editableProps && this.editableProps.indexOf(prop) >= 0) || false;
  }

  public getCategories(): string[] {
    return this.categories || [];
  }

  public isInCategory(category: string): boolean {
    return (this.categories && this.categories.indexOf(category) >= 0) || false;
  }

  public isNotInCategory(category: string): boolean {
    return !this.isInCategory(category);
  }

  public getDefaultMetrics(): {id: string, unit: string}[] {
    return this.defaultMetrics || [];
  }

  public getFirstDefaultMetric(): {id: string, unit: string} | undefined {
    return this.defaultMetrics && this.defaultMetrics.length ? this.defaultMetrics[0] : undefined;
  }

  public getManufacturer(): string | undefined  {
    return this.manufacturer;
  }

  public getManufacturerLogoUrl(): string | undefined  {
    return this.manufacturerLogoUrl;
  }

  public getMinThreadVersion(): string | undefined  {
    return this.minThreadVersion;
  }

  public isEditOnly(): boolean {
    return this.editOnly || false;
  }

  public isSDE(): boolean {
    return this.isDynamic || false;
  }

  public getDescription(): string | undefined  {
    return this.description;
  }

  public getImageUrl(): string | undefined  {
    return this.imageUrl;
  }

}
