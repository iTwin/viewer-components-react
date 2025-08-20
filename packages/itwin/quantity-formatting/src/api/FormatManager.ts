/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { BeEvent } from "@itwin/core-bentley";
import type { IModelConnection } from "@itwin/core-frontend";
import { IModelApp } from "@itwin/core-frontend";
import type { FormatDefinition, FormatsChangedArgs, FormatsProvider, MutableFormatsProvider } from "@itwin/core-quantity";
import type { FormatSet } from "@itwin/ecschema-metadata";
import { SchemaFormatsProvider, SchemaItem, SchemaItemType, SchemaKey, SchemaMatchType } from "@itwin/ecschema-metadata";
import { getUsedKindOfQuantitiesFromIModel } from "./Utils.js";

/**
 * Event arguments for format set change events.
 * @beta
 */
export interface FormatSetChangedEventArgs {
  /** The previously active format set, if any */
  previousFormatSet?: FormatSet;
  /** The newly active format set */
  currentFormatSet: FormatSet;
}

/**
 * Options for initializing the FormatManager.
 * @beta
 */
export interface FormatManagerInitializeOptions {
  /** Initial format sets to load */
  formatSets: FormatSet[];
  /** Optional fallback formats provider */
  fallbackProvider?: FormatsProvider;
  /** Whether to automatically set up schema formats when an iModel is opened */
  setupSchemaFormatSetOnIModelOpen?: boolean;
  /** Schema names to scan for KindOfQuantity definitions */
  schemaNames?: string[];
}

/**
 * Options for populating a format set of KindOfQuantities in an iModel when it is open
 * @beta
 */
export interface OnIModelOpenOptions {
  /** Schema names to scan for formats. Defaults to ["AecUnits"] */
  schemaNames?: string[];
  /** Custom label for the generated format set */
  formatSetLabel?: string;
  /** Whether to exclude used KindOfQuantities */
  excludeUsedKindOfQuantities?: boolean;
}

/**
 * A centralized manager for handling format sets and format providers in iTwin applications.
 * This class provides a singleton pattern for managing quantity formatting throughout the application,
 * with automatic integration with iModel schemas and support for custom format sets.
 *
 * @example
 * ```typescript
 * // Initialize the format manager
 * await FormatManager.initialize({
 *   formatSets: [myCustomFormatSet],
 *   setupSchemaFormatSetOnIModelOpen: true
 * });
 *
 * // Listen for format set changes
 * FormatManager.instance.onActiveFormatSetChanged.addListener((args) => {
 *   console.log(`Format set changed to: ${args.currentFormatSet.name}`);
 * });
 *
 * // Set an active format set
 * FormatManager.instance.setActiveFormatSet(myFormatSet);
 * ```
 *
 * @beta
 */
export class FormatManager {
  private static _instance?: FormatManager;
  private _formatSets: FormatSet[] = [];
  private _fallbackFormatProvider?: FormatsProvider;
  private _activeFormatSet?: FormatSet;
  private _activeFormatSetFormatsProvider?: FormatSetFormatsProvider;
  private _iModelOpened: boolean = false;
  private _removeListeners: (() => void)[] = [];
  private _options: FormatManagerInitializeOptions;

  /**
   * Event raised when the active format set changes.
   */
  public readonly onActiveFormatSetChanged = new BeEvent<(args: FormatSetChangedEventArgs) => void>();

  /**
   * Event raised when format sets are updated.
   */
  public readonly onFormatSetsChanged = new BeEvent<(formatSets: FormatSet[]) => void>();

  /**
   * Gets the singleton instance of the FormatManager.
   * @returns The FormatManager instance, or undefined if not initialized.
   */
  public static get instance(): FormatManager | undefined {
    return this._instance;
  }

  /**
   * Gets all available format sets.
   */
  public get formatSets(): FormatSet[] {
    return [...this._formatSets];
  }

  /**
   * Sets the available format sets.
   * @param formatSets - The format sets to make available.
   */
  public set formatSets(formatSets: FormatSet[]) {
    this._formatSets = [...formatSets];
    this.onFormatSetsChanged.raiseEvent(this._formatSets);
  }

  /**
   * Gets the currently active format set.
   */
  public get activeFormatSet(): FormatSet | undefined {
    return this._activeFormatSet;
  }

  /**
   * Gets the active format set's formats provider.
   */
  public get activeFormatSetFormatsProvider(): FormatSetFormatsProvider | undefined {
    return this._activeFormatSetFormatsProvider;
  }

  /**
   * Gets the current fallback formats provider.
   */
  public get fallbackFormatsProvider(): FormatsProvider | undefined {
    return this._fallbackFormatProvider;
  }

  /**
   * Sets the fallback formats provider.
   * Typically used to enable a SchemaFormatsProvider as the fallback during runtime.
   * @param provider - The formats provider to use as fallback.
   */
  public set fallbackFormatsProvider(provider: FormatsProvider | undefined) {
    this._fallbackFormatProvider = provider;
    if (this._activeFormatSet) {
      // If we have an active format set, update the formats provider to include the new fallback
      const newFormatSetFormatsProvider = new FormatSetFormatsProvider(this._activeFormatSet, this._fallbackFormatProvider);
      this._activeFormatSetFormatsProvider = newFormatSetFormatsProvider;
      if (this._iModelOpened) {
        IModelApp.formatsProvider = newFormatSetFormatsProvider;
      }
    }
  }

  /**
   * Initialize the FormatManager with the given options.
   * @param options - Configuration options for the FormatManager.
   * @throws Error if the FormatManager is already initialized.
   */
  public static async initialize(options: FormatManagerInitializeOptions): Promise<void> {
    if (this._instance) {
      throw new Error("FormatManager is already initialized. Call terminate() first if you need to reinitialize.");
    }

    this._instance = new FormatManager(options);
  }

  /**
   * Terminates the FormatManager and cleans up all listeners.
   */
  public static terminate(): void {
    if (this._instance) {
      this._instance[Symbol.dispose]();
      this._instance = undefined;
    }
  }

  /**
   * Creates a new FormatManager instance.
   * @param options - Initialization options.
   */
  public constructor(options: FormatManagerInitializeOptions) {
    this._options = options;
    this._formatSets = [...options.formatSets];
    this._fallbackFormatProvider = options.fallbackProvider;
  }

  /**
   * Cleanup method that removes all event listeners.
   */
  public [Symbol.dispose](): void {
    for (const listener of this._removeListeners) {
      listener();
    }
    this._removeListeners = [];
  }

  /**
   * Sets the active format set and updates the formats provider.
   * @param formatSet - The format set to activate.
   */
  public setActiveFormatSet(formatSet: FormatSet): void {
    const previousFormatSet = this._activeFormatSet;
    const formatSetFormatsProvider = new FormatSetFormatsProvider(formatSet, this._fallbackFormatProvider);

    this._activeFormatSet = formatSet;
    this._activeFormatSetFormatsProvider = formatSetFormatsProvider;

    if (this._iModelOpened) {
      IModelApp.formatsProvider = formatSetFormatsProvider;
    }

    this.onActiveFormatSetChanged.raiseEvent({
      previousFormatSet,
      currentFormatSet: formatSet,
    });
  }

  /**
   * Adds a new format set to the available format sets.
   * @param formatSet - The format set to add.
   */
  public addFormatSet(formatSet: FormatSet): void {
    // Check if format set with same name already exists
    const existingIndex = this._formatSets.findIndex(fs => fs.name === formatSet.name);
    if (existingIndex >= 0) {
      this._formatSets[existingIndex] = formatSet;
    } else {
      this._formatSets.push(formatSet);
    }
    this.onFormatSetsChanged.raiseEvent(this._formatSets);
  }

  /**
   * Removes a format set by name.
   * @param name - The name of the format set to remove.
   * @returns True if the format set was found and removed, false otherwise.
   */
  public removeFormatSet(name: string): boolean {
    const index = this._formatSets.findIndex(fs => fs.name === name);
    if (index >= 0) {
      this._formatSets.splice(index, 1);

      // If this was the active format set, clear it
      if (this._activeFormatSet?.name === name) {
        this._activeFormatSet = undefined;
        this._activeFormatSetFormatsProvider = undefined;
        if (this._iModelOpened && this._fallbackFormatProvider) {
          IModelApp.formatsProvider = this._fallbackFormatProvider;
        }
      }

      this.onFormatSetsChanged.raiseEvent(this._formatSets);
      return true;
    }
    return false;
  }

  /**
   * Finds a format set by name.
   * @param name - The name of the format set to find.
   * @returns The format set if found, undefined otherwise.
   */
  public getFormatSet(name: string): FormatSet | undefined {
    return this._formatSets.find(fs => fs.name === name);
  }

  /**
   * Called when an iModel is closed. Cleans up resources and listeners.
   */
  public async onIModelClose(): Promise<void> {
    // Clean up listeners
    this._removeListeners.forEach((removeListener) => removeListener());
    this._removeListeners = [];

    // Clear fallback provider if it's schema-based
    if (this._fallbackFormatProvider && this._fallbackFormatProvider instanceof SchemaFormatsProvider) {
      this._fallbackFormatProvider = undefined;
      if (this._activeFormatSetFormatsProvider) {
        this._activeFormatSetFormatsProvider.clearFallbackProvider();
      }
    }

    this._iModelOpened = false;
  }

  /**
   * Called when an iModel is opened. Sets up schema-based formats if enabled.
   * @param iModel - The opened iModel connection.
   * @param options - Optional configuration for schema format setup.
   */
  public async onIModelOpen(iModel: IModelConnection, options?: OnIModelOpenOptions): Promise<void> {
    // Set up schema-based units and formats providers
    const schemaFormatsProvider = new SchemaFormatsProvider(iModel.schemaContext, IModelApp.quantityFormatter.activeUnitSystem);
    this.fallbackFormatsProvider = schemaFormatsProvider;

    this._removeListeners.push(
      IModelApp.quantityFormatter.onActiveFormattingUnitSystemChanged.addListener((args) => {
        schemaFormatsProvider.unitSystem = args.system;
      })
    );

    // Set up schema formats if auto-setup is enabled
    if (this._options.setupSchemaFormatSetOnIModelOpen !== false) {
      await this._setupSchemaFormats(iModel, schemaFormatsProvider, options);
    }

    this._iModelOpened = true;

    // Apply active format set if we have one
    if (this._activeFormatSet && this._activeFormatSetFormatsProvider) {
      IModelApp.formatsProvider = this._activeFormatSetFormatsProvider;
    }
  }

  /**
   * Sets up formats from iModel schemas.
   * @param iModel - The iModel connection.
   * @param schemaFormatsProvider - The schema formats provider.
   * @param options - Query options.
   */
  private async _setupSchemaFormats(
    iModel: IModelConnection,
    schemaFormatsProvider: SchemaFormatsProvider,
    options?: OnIModelOpenOptions
  ): Promise<void> {
    try {
      const schemaFormatSet: FormatSet = {
        name: "SchemaFormats",
        label: options?.formatSetLabel ?? "Formats coming from current open iModel",
        formats: {},
      };

      const usedLabels: Set<string> = new Set();
      const schemaNames = options?.schemaNames ?? this._options.schemaNames ?? ["AecUnits"];

      // Get formats from known schemas
      for (const schemaName of schemaNames) {
        try {
          const schema = await iModel.schemaContext.getSchema(new SchemaKey(schemaName, SchemaMatchType.Latest));
          if (schema) {
            for (const schemaItem of schema.getItems()) {
              if (schemaItem.schemaItemType === SchemaItemType.KindOfQuantity) {
                const format = await schemaFormatsProvider.getFormat(schemaItem.fullName);
                if (format) {
                  this._processFormatLabel(format, schemaItem, usedLabels);
                  schemaFormatSet.formats[schemaItem.fullName] = format;
                }
              }
            }
          }
        } catch (error) {
          // Schema not found, continue with others
          console.warn(`Schema ${schemaName} not found or failed to load:`, error);
        }
      }

      // Get all used KindOfQuantities from the iModel if usage stats are requested
      if (!options?.excludeUsedKindOfQuantities) {
        await this._addUsedFormatsFromIModel(iModel, schemaFormatsProvider, schemaFormatSet, usedLabels);
      }

      // Add the schema format set if we found any formats
      if (Object.keys(schemaFormatSet.formats).length > 0) {
        this.addFormatSet(schemaFormatSet);

        // Set as active if no other format set is active
        if (!this._activeFormatSet) {
          this.setActiveFormatSet(schemaFormatSet);
        }
      }
    } catch (error) {
      // Failed to set up schema formats, continue without them
    }
  }

  /**
   * Processes format labels to ensure uniqueness.
   */
  private _processFormatLabel(format: FormatDefinition, schemaItem: any, usedLabels: Set<string>): void {
    if (format.label) {
      if (usedLabels.has(format.label)) {
        (format as any).label = `${format.label} (${schemaItem.key.schemaName})`;
      }
      usedLabels.add(format.label);
    }
  }

  /**
   * Adds formats that are actually used in the iModel.
   */
  private async _addUsedFormatsFromIModel(
    iModel: IModelConnection,
    schemaFormatsProvider: SchemaFormatsProvider,
    schemaFormatSet: FormatSet,
    usedLabels: Set<string>
  ): Promise<void> {
    try {
      const koqs = await getUsedKindOfQuantitiesFromIModel(iModel);

      for (const row of koqs) {
        const formatName = row.kindOfQuantityFullName;
        const format = await schemaFormatsProvider.getFormat(formatName);
        if (format && !schemaFormatSet.formats[formatName]) {
          if (format.label && usedLabels.has(format.label)) {
            const schemaName = formatName.split(".")[0];
            (format as any).label = `${format.label} (${schemaName})`;
          }
          if (format.label) {
            usedLabels.add(format.label);
          }
          schemaFormatSet.formats[formatName] = format;
        }
      }
    } catch (error) {
      // Query failed, continue without usage stats
    }
  }
}

/**
 * A formats provider that uses a FormatSet and optionally falls back to another provider.
 *
 * @important This will be replaced by FormatSetFormatsProvider from @itwin/ecschema-metadata in 5.2.
 * @beta
 */
export class FormatSetFormatsProvider implements MutableFormatsProvider {
  /**
   * Event raised when formats in the set are changed.
   */
  public readonly onFormatsChanged = new BeEvent<(args: FormatsChangedArgs) => void>();

  private _formatSet: FormatSet;
  private _fallbackProvider?: FormatsProvider;

  /**
   * Creates a new FormatSetFormatsProvider.
   * @param formatSet - The format set to provide formats from.
   * @param fallbackProvider - Optional fallback provider for formats not in the set.
   */
  public constructor(formatSet: FormatSet, fallbackProvider?: FormatsProvider) {
    this._formatSet = formatSet;
    this._fallbackProvider = fallbackProvider;
  }

  /**
   * Adds a format to the format set.
   * @param name - The name of the format.
   * @param format - The format definition.
   */
  public async addFormat(name: string, format: FormatDefinition): Promise<void> {
    this._formatSet.formats[name] = format;
    this.onFormatsChanged.raiseEvent({ formatsChanged: [name] });
  }

  /**
   * Removes the fallback provider.
   */
  public clearFallbackProvider(): void {
    this._fallbackProvider = undefined;
  }

  /**
   * Gets a format by name from the format set or fallback provider.
   * @param input - The format name or schema item name.
   * @returns The format definition if found, undefined otherwise.
   */
  public async getFormat(input: string): Promise<FormatDefinition | undefined> {
    // Normalizes any schemaItem names coming from node addon 'schemaName:schemaItemName' -> 'schemaName.schemaItemName'
    const [schemaName, itemName] = SchemaItem.parseFullName(input);
    const name = schemaName === "" ? itemName : `${schemaName}.${itemName}`;

    const format = this._formatSet.formats[name];
    if (format) return format;
    if (this._fallbackProvider) return this._fallbackProvider.getFormat(name);
    return undefined;
  }

  /**
   * Removes a format from the format set.
   * @param name - The name of the format to remove.
   */
  public async removeFormat(name: string): Promise<void> {
    delete this._formatSet.formats[name];
    this.onFormatsChanged.raiseEvent({ formatsChanged: [name] });
  }

  /**
   * Gets the underlying format set.
   */
  public get formatSet(): FormatSet {
    return this._formatSet;
  }

  /**
   * Gets the fallback provider.
   */
  public get fallbackProvider(): FormatsProvider | undefined {
    return this._fallbackProvider;
  }
}
