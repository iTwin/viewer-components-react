/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

/** Index signature holding preferences content
 *
 * @internal
 */
interface KeyContentProps<Type> {
  [preferenceKey: string]: Type;
}

export interface BrowserStorageOptions {
  /** indicate whether or not delete function should throw an error if the provided key cannot be found. */
  throwOnDeleteMissingKey?: boolean;
  itemKeyName: string;
}

export class BrowserStorage<Type>  {

  private readonly _itemKeyName;
  private readonly _throwOnDeleteMissingKey;

  constructor(opts: BrowserStorageOptions) {
    this._itemKeyName = opts.itemKeyName;
    this._throwOnDeleteMissingKey = opts.throwOnDeleteMissingKey ?? true;
  }

  private loadFromStorage() {
    const storage = window.localStorage;

    let map: KeyContentProps<Type> = {};
    const itemStr = storage.getItem(this._itemKeyName);
    if (itemStr === null) {
      return undefined;
    }
    if (!itemStr || itemStr === "{}")
      return map;

    map = JSON.parse(itemStr);
    return map;
  }

  public get(key: string|undefined) {
    const map = this.loadFromStorage();
    if (map === undefined)
      return undefined;

    if (key) {
      if (!Object.keys(map).includes(key))
        return undefined;

      return map[key];
    } else {  // No key provided, return all objects
      return Object.entries(map).map(([_key, value]) => value);
    }
  }

  public getContent() {
    return this.loadFromStorage();
  }

  public delete(key: string) {
    const map = this.loadFromStorage();
    if (map === undefined) {
      if (this._throwOnDeleteMissingKey)
        throw new Error("Could not find key from storage.");
      else
        return;
    }

    if (!Object.keys(map).includes(key)) {
      if (this._throwOnDeleteMissingKey)
        throw Error("Could not find key from storage.");
      else
        return;
    }
    delete map[key];
    window.localStorage.setItem(this._itemKeyName, JSON.stringify(map));
  }

  public deleteMatchingContent(content: Type) {
    const map = this.loadFromStorage();
    if (map === undefined) {
      return;
    }
    const contentJson = JSON.stringify(content);
    for (const [key, value] of Object.entries(map)) {
      if (JSON.stringify(value) === contentJson)
        delete map[key];
    }

    window.localStorage.setItem(this._itemKeyName, JSON.stringify(map));
  }

  public save(key: string, content: Type) {
    let map = this.loadFromStorage();
    if (map === undefined)
      map = {};

    map[key] = content;

    const itemValue = JSON.stringify(map);
    window.localStorage.setItem(this._itemKeyName, itemValue);
  }
}
