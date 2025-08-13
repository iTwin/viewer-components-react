/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { BeEvent } from "@itwin/core-bentley";
import { IModelApp, IModelConnection } from "@itwin/core-frontend";
import type { FormatDefinition, FormatsChangedArgs, FormatsProvider, MutableFormatsProvider } from "@itwin/core-quantity";
import type { FormatSet } from "@itwin/ecschema-metadata";
import { SchemaFormatsProvider, SchemaItemType, SchemaKey, SchemaMatchType } from "@itwin/ecschema-metadata";

export class FormatManager {
  protected static _instance: FormatManager;
  private _formatSets: FormatSet[] = [];
  private _fallbackFormatProvider?: FormatsProvider;
  private _activeFormatSet?: FormatSet;
  private _iModelOpened: boolean = false;
  private _removeListeners: (() => void)[] = [];

  public static get instance(): FormatManager {
    return this._instance;
  }

  public get formatSets(): FormatSet[] {
    return this._formatSets;
  }

  public set formatSets(formatSets: FormatSet[]) {
    this._formatSets = formatSets;
  }

  public get activeFormatSet(): FormatSet | undefined {
    return this._activeFormatSet;
  }

  /** Initialize with a set of format sets to use */
  public static async initialize(formatSets: FormatSet[], fallbackProvider?: FormatsProvider): Promise<void> {
    if (this._instance)
      throw new Error("FormatManager is already initialized.");

    this._instance = new FormatManager(formatSets, fallbackProvider);

    this._instance._removeListeners.push(IModelConnection.onOpen.addListener(async (iModel: IModelConnection) => {
      // Initialize the formats provider for the opened iModel
      this._instance._iModelOpened = true;
      await this._instance.onIModelOpen(iModel);
    }));

    this._instance._removeListeners.push(IModelConnection.onClose.addListener(async () => {
      this._instance._iModelOpened = false;
    }));
  }

  public constructor(formatSets: FormatSet[], fallbackProvider?: FormatsProvider) {
    this._formatSets = formatSets;
    this._fallbackFormatProvider = fallbackProvider;
  }

  public [Symbol.dispose](): void {
    for (const listener of this._removeListeners) {
      listener();
    }
    this._removeListeners = [];
  }

  public setActiveFormatSet(formatSet: FormatSet): void {
    const formatSetFormatsProvider = new FormatSetFormatsProvider(formatSet, this._fallbackFormatProvider);
    this._activeFormatSet = formatSet;

    if (this._iModelOpened) {
      IModelApp.formatsProvider = formatSetFormatsProvider;
    }
  }

  // Typically, enables a SchemaFormatsProvider to be the fallback during runtime.
  public set fallbackFormatsProvider(provider: FormatsProvider | undefined) {
    this._fallbackFormatProvider = provider;
    if (this._activeFormatSet) {
      // If we have an active format set, we need to update the formats provider to include the new fallback.
      const newFormatSetFormatsProvider = new FormatSetFormatsProvider(this._activeFormatSet, this._fallbackFormatProvider);
      IModelApp.formatsProvider = newFormatSetFormatsProvider;
    }
  }

  public get fallbackFormatsProvider(): FormatsProvider | undefined {
    return this._fallbackFormatProvider;
  }

  public async onIModelOpen(iModel: IModelConnection): Promise<void> {
    // Set up schema-based units and formats providers

    const schemaFormatsProvider = new SchemaFormatsProvider(iModel.schemaContext, IModelApp.quantityFormatter.activeUnitSystem);
    this.fallbackFormatsProvider = schemaFormatsProvider;

    // Query schemas for KindOfQuantity items
    try {
      const schemaFormatSet: FormatSet = {
        name: "SchemaFormats",
        label: "Example Format Set",
        formats: {}
      };
      const reader = iModel.createQueryReader("SELECT\n  ks.Name || '.' || k.Name AS kindOfQuantityFullName,\n  COUNT(*) AS propertyCount,\n  json_group_array(p.Name) AS propertyNames\nFROM\n  ECDbMeta.ECPropertyDef p\n  JOIN ECDbMeta.KindOfQuantityDef k ON k.ECInstanceId = p.KindOfQuantity.Id\n  JOIN ECDbMeta.ECSchemaDef ks ON ks.ECInstanceId = k.Schema.Id\nGROUP BY\n  ks.Name,\n  k.Name\nORDER BY\n  propertyCount DESC;");
      while (await reader.step()) {
        console.log(reader.current[0]);
        const formatName = reader.current[0].kindOfQuantityFullName;
        const format = await schemaFormatsProvider.getFormat(formatName);
        if (format) {
          schemaFormatSet.formats[formatName] = format;
        }
      }
      // Try to get known schemas that typically contain KindOfQuantity items, and get all the formats from kind of quantities
      const schemaNames = ["AecUnits"];

      for (const schemaName of schemaNames) {
        try {
          const schema = await iModel.schemaContext.getSchema(new SchemaKey(schemaName, SchemaMatchType.Latest));
            if (schema) {
            for (const schemaItem of schema.getItems()) {
              console.log(schemaItem)
              if (schemaItem.schemaItemType === SchemaItemType.KindOfQuantity) {
                const format = await schemaFormatsProvider.getFormat(schemaItem.fullName);
                if (format) {
                  schemaFormatSet.formats[schemaItem.fullName] = format;
                }
              }
            }
          }
        } catch (error) {
          console.warn(`Schema ${schemaName} not found or failed to load:`, error);
        }
      }

      // Set this as the active format set if we found any formats
      if (Object.keys(schemaFormatSet.formats).length > 0) {
        this.setActiveFormatSet(schemaFormatSet);
        console.log(`Created schema-based format set with ${Object.keys(schemaFormatSet.formats).length} formats`);
      } else {
        console.log("No KindOfQuantity items found in known schemas");
      }

    } catch (error) {
      console.error("Failed to query schema items:", error);
    }
  }
}

export class FormatSetFormatsProvider implements MutableFormatsProvider {
  public onFormatsChanged: BeEvent<(args: FormatsChangedArgs) => void> = new BeEvent<(args: FormatsChangedArgs) => void>();

  private _formatSet: FormatSet;
  private _fallbackProvider?: FormatsProvider;

  public constructor(formatSet: FormatSet, fallbackProvider?: FormatsProvider) {
    this._formatSet = formatSet;
    this._fallbackProvider = fallbackProvider;
  }

  public async addFormat(name: string, format: FormatDefinition): Promise<void> {
    this._formatSet.formats[name] = format;
    this.onFormatsChanged.raiseEvent({ formatsChanged: [name] });
  }

  public async getFormat(name: string): Promise<FormatDefinition | undefined> {
    const format = this._formatSet.formats[name];
    if (format)
      return format;
    if (this._fallbackProvider)
      return this._fallbackProvider.getFormat(name);
    return undefined;
  }

  public async removeFormat(name: string): Promise<void> {
    delete this._formatSet.formats[name];
    this.onFormatsChanged.raiseEvent({ formatsChanged: [name] });
  }
}
