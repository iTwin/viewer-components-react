/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { BeEvent } from "@itwin/core-bentley";
import { IModelApp } from "@itwin/core-frontend";
import { FormatSetFormatsProvider, SchemaFormatsProvider } from "@itwin/ecschema-metadata";

import type { IModelConnection } from "@itwin/core-frontend";
import type { FormatDefinition, FormatsProvider } from "@itwin/core-quantity";
import type { FormatSet } from "@itwin/ecschema-metadata";

export class FormatManager {
  protected static _instance: FormatManager;
  private _formatSets: FormatSet[] = [];
  private _fallbackFormatProvider?: FormatsProvider;
  private _activeFormatSet?: FormatSet;
  private _activeFormatSetFormatsProvider?: FormatSetFormatsProvider;
  private _iModelOpened: boolean = false;
  private _removeListeners: (() => void)[] = [];

  /** Event raised when the active format set changes */
  public readonly onActiveFormatSetChanged = new BeEvent<(formatSet: FormatSet | undefined) => void>();

  public static get instance(): FormatManager | undefined {
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

  public get activeFormatSetFormatsProvider(): FormatSetFormatsProvider | undefined {
    return this._activeFormatSetFormatsProvider;
  }

  /** Initialize with a set of format sets to use */
  public static async initialize(formatSets: FormatSet[], fallbackProvider?: FormatsProvider): Promise<void> {
    if (this._instance) throw new Error("FormatManager is already initialized.");

    this._instance = new FormatManager(formatSets, fallbackProvider);
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
    const formatSetFormatsProvider = new FormatSetFormatsProvider({ formatSet, fallbackProvider: this._fallbackFormatProvider });
    this._activeFormatSet = formatSet;
    this._activeFormatSetFormatsProvider = formatSetFormatsProvider;

    if (this._iModelOpened) {
      IModelApp.formatsProvider = formatSetFormatsProvider;
    }

    this.onActiveFormatSetChanged.raiseEvent(formatSet);
  }

  // Typically, enables a SchemaFormatsProvider to be the fallback during runtime.
  public set fallbackFormatsProvider(provider: FormatsProvider | undefined) {
    this._fallbackFormatProvider = provider;
    if (this._activeFormatSet) {
      // If we have an active format set, we need to update the formats provider to include the new fallback.
      const newFormatSetFormatsProvider = new FormatSetFormatsProvider({ formatSet: this._activeFormatSet, fallbackProvider: this._fallbackFormatProvider });
      this._activeFormatSetFormatsProvider = newFormatSetFormatsProvider;
      IModelApp.formatsProvider = newFormatSetFormatsProvider;
    }
  }

  public get fallbackFormatsProvider(): FormatsProvider | undefined {
    return this._fallbackFormatProvider;
  }

  public async onIModelClose() {
    // Clean up listeners
    this._removeListeners.forEach((removeListener) => removeListener());
    this._fallbackFormatProvider = undefined;
    if (this._activeFormatSetFormatsProvider) {
      this._activeFormatSetFormatsProvider.clearFallbackProvider(); // Works here because the fallback provider is the SchemaFormatsProvider used onIModelOpen.
    }
    this._iModelOpened = false;
  }

  /**
   * If FormatSetFormatsProvider was successfully set, renders the usage of IModelApp.quantityFormatter.activeUnitSystem pointless when formatting.
   */
  public async onIModelOpen(iModel: IModelConnection): Promise<void> {
    // Set up schema-based units and formats providers
    const schemaFormatsProvider = new SchemaFormatsProvider(iModel.schemaContext, IModelApp.quantityFormatter.activeUnitSystem);
    this.fallbackFormatsProvider = schemaFormatsProvider;
    this._removeListeners.push(
      this.onActiveFormatSetChanged.addListener(async (formatSet) => {
        if (formatSet && formatSet.unitSystem !== schemaFormatsProvider.unitSystem) {
          schemaFormatsProvider.unitSystem = formatSet.unitSystem;
        }
        // While there are tools still using IModelApp.quantityFormatter.activeUnitSystem, keep it in sync with the active format set.
        if (formatSet && formatSet.unitSystem !== IModelApp.quantityFormatter.activeUnitSystem) {
          await IModelApp.quantityFormatter.setActiveUnitSystem(formatSet.unitSystem);
        }
      }),
    );
    // Query schemas for KindOfQuantity items
    try {
      const schemaFormatSet: FormatSet = {
        name: "AutogeneratedFormatSet",
        label: "Auto-generated Format Set from iModel",
        unitSystem: IModelApp.quantityFormatter.activeUnitSystem,
        description:
          "This format set was automatically created based on the data in the opened iModel. It provides formatting for all quantities used in the model.",
        formats: {},
      };
      // Used until https://github.com/iTwin/bis-schemas/issues/566 is resolved
      // If there are duplicate labels, use the unique fullName of the KoQ instead of it's label.
      const usedLabels: Set<string> = new Set();

      // QuantityFormatter's _formatSpecsRegistry uses canonical names like "DefaultToolsUnits.LENGTH",
      // not schema names like "CivilUnits.LENGTH". When a format edit fires onFormatsChanged,
      // the QuantityFormatter only rebuilds entries whose name is in the registry. To ensure
      // edits propagate, we store formats under canonical names and alias schema KoQs to them.
      const canonicalByItemName: Record<string, string> = {
        LENGTH: "DefaultToolsUnits.LENGTH",
        ANGLE: "DefaultToolsUnits.ANGLE",
        AREA: "DefaultToolsUnits.AREA",
        VOLUME: "DefaultToolsUnits.VOLUME",
        LENGTH_COORDINATE: "DefaultToolsUnits.LENGTH_COORDINATE",
        STATION: "CivilUnits.STATION",
      };

      // Phase 1: Collect all schema KoQ formats from the ECSQL query, grouped by item name.
      const ecsqlQuery = `
        SELECT
          ks.Name || '.' || k.Name AS kindOfQuantityFullName,
          COUNT(*) AS propertyCount,
          json_group_array(p.Name) AS propertyNames
        FROM
          ECDbMeta.ECPropertyDef p
          JOIN ECDbMeta.KindOfQuantityDef k ON k.ECInstanceId = p.KindOfQuantity.Id
          JOIN ECDbMeta.ECSchemaDef ks ON ks.ECInstanceId = k.Schema.Id
        GROUP BY
          ks.Name,
          k.Name
        ORDER BY
          propertyCount DESC;
      `;
      const reader = iModel.createQueryReader(ecsqlQuery);
      const allRows = await reader.toArray();

      const schemaFormats = new Map<string, FormatDefinition>();
      const byItemName = new Map<string, string[]>();
      for (const row of allRows) {
        const formatName: string = row[0];
        const format = await schemaFormatsProvider.getFormat(formatName);
        if (format) {
          schemaFormats.set(formatName, format);
          const itemName = formatName.split(".")[1];
          if (itemName) {
            const existing = byItemName.get(itemName) ?? [];
            existing.push(formatName);
            byItemName.set(itemName, existing);
          }
        }
      }

      // Phase 2: For each canonical KoQ, adopt a matching schema format under the canonical name.
      // The adopted format's `name` is changed so addFormat() fires with the canonical name,
      // which the QuantityFormatter's registry recognizes. Original schema entries become aliases.
      for (const [itemName, canonicalName] of Object.entries(canonicalByItemName)) {
        const matches = byItemName.get(itemName);
        if (!matches || matches.length === 0) continue;

        const sourceFormat = schemaFormats.get(matches[0])!;
        const canonicalFormat: FormatDefinition = { ...sourceFormat, name: canonicalName };
        if (canonicalFormat.label) {
          usedLabels.add(canonicalFormat.label);
        }
        schemaFormatSet.formats[canonicalName] = canonicalFormat;

        // Alias all matching schema KoQs to the canonical entry (hidden in the format selector)
        for (const matchName of matches) {
          if (matchName !== canonicalName) {
            schemaFormatSet.formats[matchName] = canonicalName;
          }
          schemaFormats.delete(matchName);
        }
      }

      // Phase 3: Add remaining schema KoQs that don't match any canonical entry.
      for (const [formatName, format] of schemaFormats) {
        if (format.label) {
          if (usedLabels.has(format.label)) {
            const schemaName = formatName.split(".")[0];
            (format as any).label = `${format.label} (${schemaName})`;
          }
          usedLabels.add(format.label);
        }
        schemaFormatSet.formats[formatName] = format;
      }

      // Set this as the active format set if we found any formats
      if (Object.keys(schemaFormatSet.formats).length > 0) {
        this._iModelOpened = true;
        this._formatSets.push(schemaFormatSet);
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
