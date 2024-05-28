/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
import type { ITwinIdArg, PreferenceArg, PreferenceKeyArg, UserPreferencesAccess } from "@itwin/core-frontend";
import { BrowserStorage } from "./BrowserStorage";

/** Index signature holding preferences content
 *
 * @internal
 */
interface KeyContentProps {
  [preferenceKey: string]: any;
}

/**
 * @beta
 */
export interface PreferencesBrowserStorageOptions {
  /** indicate whether or not delete function should throw an error if the provided key cannot be found. */
  throwOnDeleteMissingKey?: boolean;
}

/** User preferences implementation using browser's local storage.
 * It creates storage item key in the form of:
 *     <storageItemKeyPrefix>.<itwin_guid?>.<imodel_guid?>
 *
 * <itwin_guid> and <imodel_guid> being optional.
 *
 * Each entry in the storage is a serialized JSON of the following index signature:
 * {
 *  "<preference_namespace?>.<preference_key>": {
 *    ...
 *    <preferences_json_content>
 *   },
 *   ...
 * }
 * @beta
 */
export class PreferencesBrowserStorage implements UserPreferencesAccess {
  private readonly _options: PreferencesBrowserStorageOptions | undefined;
  private readonly _storageItemKeyPrefix: string;

  constructor(storageItemKeyPrefix: string, opts?: PreferencesBrowserStorageOptions) {
    this._options = opts;
    this._storageItemKeyPrefix = storageItemKeyPrefix;
  }

  private getStorageItemKey(arg: ITwinIdArg) {
    const itwinIdStr = arg.iTwinId ? `.${arg.iTwinId}` : "";
    const imodelIdStr = arg.iModelId ? `.${arg.iModelId}` : "";
    return `${this._storageItemKeyPrefix}${itwinIdStr}${imodelIdStr}`;
  }

  private static getPreferenceKey(arg: PreferenceKeyArg) {
    if (arg.key) {
      const nsStr = arg.namespace ? `${arg.namespace}.` : "";
      return `${nsStr}${arg.key}`;
    }

    return "";
  }

  public async get(arg: PreferenceKeyArg & ITwinIdArg) {
    const storage = new BrowserStorage<KeyContentProps>({ itemKeyName: this.getStorageItemKey(arg) });
    return storage.get(PreferencesBrowserStorage.getPreferenceKey(arg));
  }

  public async delete(arg: PreferenceKeyArg & ITwinIdArg) {
    const storage = new BrowserStorage<KeyContentProps>({ itemKeyName: this.getStorageItemKey(arg) });
    storage.delete(PreferencesBrowserStorage.getPreferenceKey(arg));
  }

  public async save(arg: PreferenceArg & ITwinIdArg) {
    const storage = new BrowserStorage<KeyContentProps>({ itemKeyName: this.getStorageItemKey(arg) });
    storage.save(PreferencesBrowserStorage.getPreferenceKey(arg), arg.content);
  }
}
