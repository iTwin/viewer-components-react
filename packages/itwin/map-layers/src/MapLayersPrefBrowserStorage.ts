/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { ITwinIdArg, PreferenceArg, PreferenceKeyArg, TokenArg, UserPreferencesAccess } from "@itwin/core-frontend";

/** Index signature holding preferences content
 *
 * @internal
 */
interface KeyContentProps {
  [key: string]: any;
}

/** Index signature holding preferences content
  * This class is user preferences implementation using browser's local storage.
  * It creates item key in the form of:
  *     itwinjs.mapLayers.<project_guid?>.<imodel_guid?>
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
export class MapLayersPrefBrowserStorage implements UserPreferencesAccess {

  private static readonly preferenceKeyPrefix = "itwinjs.mapLayers";

  private static getStorageItemKey(arg: ITwinIdArg) {
    const itwinIdStr = arg.iTwinId ? `.${arg.iTwinId}` : "";
    const imodelIdStr = arg.iModelId ? `.${arg.iModelId}` : "";
    return `${MapLayersPrefBrowserStorage.preferenceKeyPrefix}${itwinIdStr}${imodelIdStr}`
  }

  private static getPreferenceKey(arg: PreferenceKeyArg) {
    const nsStr = arg.namespace ? `${arg.namespace}.` : ""
    return `${nsStr}${arg.key}`;
  }

  private static loadFromStorage(arg: PreferenceKeyArg & ITwinIdArg) {
    const storage = window.localStorage;

    let map: KeyContentProps = {};
    const itemStr = storage.getItem(MapLayersPrefBrowserStorage.getStorageItemKey(arg));
    if (itemStr === null) {
      return undefined
    }
    if (!itemStr || itemStr === "{}")
      return map;

    map = JSON.parse(itemStr);
    return map;
  }

  public async get(arg: PreferenceKeyArg & ITwinIdArg) {
    let map = MapLayersPrefBrowserStorage.loadFromStorage(arg);
    if (map == undefined)
      return undefined;

    if (arg.key) {
      if (!Object.keys(map).includes(arg.key))
        return undefined

      const nsStr = arg.namespace ? `${arg.namespace}.` : ""
      const prefKey = `${nsStr}${arg.key}`;
      return [map[prefKey]];
    }
    else {  // No key provided, return all objects
      const values = [];
      for (const [key, value] of Object.entries(map))
        values.push(value)
      return values;
    }
  }

  public async delete(arg: PreferenceKeyArg & ITwinIdArg) {
    const map = MapLayersPrefBrowserStorage.loadFromStorage(arg);
    if (map === undefined) {
      // We *MUST* throw here, this what 'MapLayerPreferences.replaceSource' expect when there is no match for the provided key.
      throw "Could not find key from storage."
    }
    delete map[MapLayersPrefBrowserStorage.getStorageItemKey(arg)];
    window.localStorage.setItem(MapLayersPrefBrowserStorage.getStorageItemKey(arg), JSON.stringify(map));
  }

  public async save(arg: PreferenceArg & ITwinIdArg & TokenArg) {

    let map = MapLayersPrefBrowserStorage.loadFromStorage(arg);
    if (map == undefined)
      map = {};

    map[MapLayersPrefBrowserStorage.getPreferenceKey(arg)] = arg.content;

    const itemValue = JSON.stringify(map);
    window.localStorage.setItem(MapLayersPrefBrowserStorage.getStorageItemKey(arg), itemValue);
  }
}
