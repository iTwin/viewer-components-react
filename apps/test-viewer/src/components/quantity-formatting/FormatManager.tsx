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

// QuantityFormatter's _formatSpecsRegistry uses canonical names like "DefaultToolsUnits.LENGTH",
// not schema names like "CivilUnits.LENGTH". To keep measurement-tool edits propagating in
// the test viewer without changing the meaning of every schema KoQ, we preserve the original
// schema entries and add canonical measurement keys as aliases to selected schema entries.
const canonicalByItemName: Record<string, string> = {
  LENGTH: "DefaultToolsUnits.LENGTH",
  ANGLE: "DefaultToolsUnits.ANGLE",
  AREA: "DefaultToolsUnits.AREA",
  VOLUME: "DefaultToolsUnits.VOLUME",
  LENGTH_COORDINATE: "DefaultToolsUnits.LENGTH_COORDINATE",
  STATION: "CivilUnits.STATION",
};

/** Query the iModel for all KoQ items and resolve their format definitions via the schema provider. */
async function querySchemaFormats(
  iModel: IModelConnection,
  schemaFormatsProvider: SchemaFormatsProvider,
): Promise<{ schemaFormats: Map<string, FormatDefinition>; byItemName: Map<string, string[]> }> {
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
  return { schemaFormats, byItemName };
}

/**
 * For each canonical KoQ (e.g., DefaultToolsUnits.LENGTH), add an alias to the selected
 * schema entry so QuantityFormatter registry updates continue to reach the measurement tools.
 * Original schema entries stay intact and are added separately.
 */
function addCanonicalAliases(byItemName: Map<string, string[]>): Record<string, string> {
  const formats: Record<string, string> = {};

  for (const [itemName, canonicalName] of Object.entries(canonicalByItemName)) {
    const matches = byItemName.get(itemName);
    if (!matches || matches.length === 0) continue;

    // The ECSQL query orders by propertyCount DESC, so matches[0] is the KoQ referenced
    // by the most properties in the iModel — i.e., the most relevant default source for this item name.
    const sourceFormatName = matches[0];
    if (!sourceFormatName || sourceFormatName === canonicalName) {
      continue;
    }

    formats[canonicalName] = sourceFormatName;
  }

  return formats;
}

/**
 * Add remaining schema KoQs that don't match any canonical entry.
 * Clones format objects before modifying labels to avoid mutating provider-owned instances.
 */
function addSchemaFormats(schemaFormats: Map<string, FormatDefinition>, usedLabels: Set<string>): Record<string, FormatDefinition> {
  const formats: Record<string, FormatDefinition> = {};
  for (const [formatName, format] of schemaFormats) {
    // Clone to avoid mutating the SchemaFormatsProvider's cached objects
    let entry: FormatDefinition = { ...format };
    if (entry.label) {
      let label = entry.label;
      if (usedLabels.has(label)) {
        const schemaName = formatName.split(".")[0];
        label = `${label} (${schemaName})`;
        entry = { ...entry, label };
      }
      usedLabels.add(label);
    }
    formats[formatName] = entry;
  }
  return formats;
}

function getCanonicalFormatName(formatName: string): string | undefined {
  if (Object.values(canonicalByItemName).includes(formatName)) {
    return formatName;
  }

  const itemName = formatName.split(".")[1];
  return itemName ? canonicalByItemName[itemName] : undefined;
}

export class FormatManager {
  protected static _instance: FormatManager;
  private _formatSets: FormatSet[] = [];
  private _fallbackFormatProvider?: FormatsProvider;
  private _activeFormatSetName?: string;
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

  /** Name-based lookup — robust against cloned or reconstructed FormatSet objects. */
  public get activeFormatSet(): FormatSet | undefined {
    return this._formatSets.find((fs) => fs.name === this._activeFormatSetName);
  }

  public get activeFormatSetFormatsProvider(): FormatSetFormatsProvider | undefined {
    return this._activeFormatSetFormatsProvider;
  }

  public async updateActiveFormat(formatKey: string, format: FormatDefinition): Promise<void> {
    const provider = this._activeFormatSetFormatsProvider;
    if (!provider) {
      return;
    }

    await provider.addFormat(formatKey, { ...format, name: formatKey });

    const canonicalFormatName = getCanonicalFormatName(formatKey);
    if (canonicalFormatName && canonicalFormatName !== formatKey) {
      await provider.addFormat(canonicalFormatName, formatKey);
    }
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
    this._activeFormatSetName = formatSet.name;
    this._activeFormatSetFormatsProvider = formatSetFormatsProvider;

    if (this._iModelOpened) {
      IModelApp.formatsProvider = formatSetFormatsProvider;
    }

    this.onActiveFormatSetChanged.raiseEvent(formatSet);
  }

  // Typically, enables a SchemaFormatsProvider to be the fallback during runtime.
  public set fallbackFormatsProvider(provider: FormatsProvider | undefined) {
    this._fallbackFormatProvider = provider;
    const activeSet = this.activeFormatSet;
    if (activeSet) {
      // If we have an active format set, we need to update the formats provider to include the new fallback.
      const newFormatSetFormatsProvider = new FormatSetFormatsProvider({ formatSet: activeSet, fallbackProvider: this._fallbackFormatProvider });
      this._activeFormatSetFormatsProvider = newFormatSetFormatsProvider;
      IModelApp.formatsProvider = newFormatSetFormatsProvider;
    }
  }

  public get fallbackFormatsProvider(): FormatsProvider | undefined {
    return this._fallbackFormatProvider;
  }

  public async onIModelClose() {
    this._removeListeners.forEach((removeListener) => removeListener());
    this._removeListeners = [];
    this._fallbackFormatProvider = undefined;
    if (this._activeFormatSetFormatsProvider) {
      this._activeFormatSetFormatsProvider.clearFallbackProvider(); // Works here because the fallback provider is the SchemaFormatsProvider used onIModelOpen.
    }
    // Remove auto-generated format sets from this iModel session
    this._formatSets = this._formatSets.filter((fs) => fs.name !== "AutogeneratedFormatSet");
    this._iModelOpened = false;
  }

  /**
   * If FormatSetFormatsProvider was successfully set, renders the usage of IModelApp.quantityFormatter.activeUnitSystem pointless when formatting.
   */
  public async onIModelOpen(iModel: IModelConnection): Promise<void> {
    // Guard against repeated calls without an intervening close
    if (this._iModelOpened) {
      await this.onIModelClose();
    }

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

    try {
      const { schemaFormats, byItemName } = await querySchemaFormats(iModel, schemaFormatsProvider);

      // Used until https://github.com/iTwin/bis-schemas/issues/566 is resolved.
      // If there are duplicate labels, use the unique fullName of the KoQ instead of its label.
      const usedLabels = new Set<string>();

      const canonicalEntries = addCanonicalAliases(byItemName);
      const remainingEntries = addSchemaFormats(schemaFormats, usedLabels);

      const schemaFormatSet: FormatSet = {
        name: "AutogeneratedFormatSet",
        label: "Auto-generated Format Set from iModel",
        unitSystem: IModelApp.quantityFormatter.activeUnitSystem,
        description:
          "This format set was automatically created based on the data in the opened iModel. It provides formatting for all quantities used in the model.",
        formats: { ...canonicalEntries, ...remainingEntries },
      };

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
