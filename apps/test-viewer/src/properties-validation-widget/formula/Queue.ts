/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
export class Queue<TData> {
  constructor(private _dataStore: TData[] = []) {}

  public enqueue(element: TData): Queue<TData> {
    this._dataStore.push(element);
    return this;
  }

  public dequeue(): TData | undefined {
    if (this._dataStore.length === 0) {
      return undefined;
    }

    return this._dataStore.splice(0, 1)[0];
  }

  public dequeueN(n: number): TData[] {
    if (n <= 0 || this._dataStore.length === 0) {
      return [];
    }

    return this._dataStore.splice(0, n);
  }

  public peek(): TData | undefined {
    if (this._dataStore.length === 0) {
      return undefined;
    }
    return this._dataStore[0];
  }

  public get length(): number {
    return this._dataStore.length;
  }

  public get asArray(): TData[] {
    return [...this._dataStore];
  }
}
