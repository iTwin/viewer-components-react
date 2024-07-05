/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
export class Stack<TData> {
  private _dataStore: TData[] = [];
  constructor() {}

  public push(element: TData): Stack<TData> {
    this._dataStore.push(element);
    return this;
  }

  public pop(): TData | undefined {
    if (this._dataStore.length === 0) {
      return undefined;
    }
    return this._dataStore.pop();
  }

  public popN(n: number): TData[] {
    if (n <= 0 || this._dataStore.length === 0) {
      return [];
    }

    if (this._dataStore.length >= n) {
      return [...this._dataStore.splice(this._dataStore.length - n)].reverse();
    } else {
      const result = [...this._dataStore];
      this._dataStore = [];
      return result.reverse();
    }
  }

  public peek(): TData | undefined {
    if (this._dataStore.length === 0) {
      return undefined;
    }
    return this._dataStore[this._dataStore.length - 1];
  }

  public peekN(n: number): TData[] {
    if (n <= 0 || this._dataStore.length === 0) {
      return [];
    }

    if (this._dataStore.length >= n) {
      return this._dataStore.slice(-n).reverse();
    } else {
      return [...this._dataStore].reverse();
    }
  }

  public indexOf(element: TData): number {
    return this.findIndex((e) => e === element);
  }

  public findIndex(filter: (element: TData) => boolean): number {
    for (let i = 0; i < this._dataStore.length; i++) {
      if (filter(this._dataStore[this._dataStore.length - 1 - i])) {
        return i;
      }
    }
    return -1;
  }

  public get length(): number {
    return this._dataStore.length;
  }

  public get asArray(): TData[] {
    return [...this._dataStore].reverse();
  }
}
