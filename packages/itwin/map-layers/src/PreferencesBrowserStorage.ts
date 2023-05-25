/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { ITwinIdArg, PreferenceArg, PreferenceKeyArg, UserPreferencesAccess } from "@itwin/core-frontend";

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
  *     <storageItemKeyPrefix>.<project_guid?>.<imodel_guid?>
  *
  * <project_guid> and <imodel_guid> being optional.
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
    const nsStr = arg.namespace ? `${arg.namespace}.` : "";
    return `${nsStr}${arg.key}`;
  }

  private loadFromStorage(arg: PreferenceKeyArg & ITwinIdArg) {
    const storage = window.localStorage;

    let map: KeyContentProps = {};
    const itemStr = storage.getItem(this.getStorageItemKey(arg));
    if (itemStr === null) {
      return undefined;
    }
    if (!itemStr || itemStr === "{}")
      return map;

    map = JSON.parse(itemStr);
    return map;
  }

  public async get(arg: PreferenceKeyArg & ITwinIdArg) {
    const map = this.loadFromStorage(arg);
    if (map === undefined)
      return undefined;

    if (arg.key) {
      if (!Object.keys(map).includes(arg.key))
        return undefined;

      const nsStr = arg.namespace ? `${arg.namespace}.` : "";
      const prefKey = `${nsStr}${arg.key}`;
      return [map[prefKey]];
    } else {  // No key provided, return all objects
      const values = [];
      for (const [_key, value] of Object.entries(map))
        values.push(value);
      return values;
    }
  }

  public async delete(arg: PreferenceKeyArg & ITwinIdArg) {
    const map = this.loadFromStorage(arg);
    if (map === undefined) {
      if (this._options?.throwOnDeleteMissingKey)
        throw new Error("Could not find key from storage.");
      else
        return;
    }

    const prefKey = PreferencesBrowserStorage.getPreferenceKey(arg);
    if (!Object.keys(map).includes(prefKey)) {
      if (this._options?.throwOnDeleteMissingKey)
        throw Error("Could not find key from storage.");
      else
        return;
    }
    delete map[prefKey];
    window.localStorage.setItem(this.getStorageItemKey(arg), JSON.stringify(map));
  }

  public async save(arg: PreferenceArg & ITwinIdArg) {
    let map = this.loadFromStorage(arg);
    if (map === undefined)
      map = {};

    map[PreferencesBrowserStorage.getPreferenceKey(arg)] = arg.content;

    const itemValue = JSON.stringify(map);
    window.localStorage.setItem(this.getStorageItemKey(arg), itemValue);
  }
}
