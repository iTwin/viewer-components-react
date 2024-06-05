/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
export class StringBuilder {
  private readonly _stringParts: string[];

  constructor(...initial: string[]) {
    this._stringParts = initial.filter((v) => !!v);
  }

  public push(value: string) {
    value && this._stringParts.push(value);
  }

  public pop() {
    return this._stringParts.pop();
  }

  public get length() {
    return this._stringParts.length;
  }

  public get value() {
    return this._stringParts.join("");
  }
}
