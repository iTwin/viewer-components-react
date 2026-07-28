/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
export class InputStream {
  private _nextIndex = 0;
  private _current = "";

  constructor(private readonly _stream: string) {}

  public get next(): string {
    this._current = this.isEOF ? "" : this._stream[this._nextIndex++];
    return this.current;
  }

  public get undo(): string {
    if (this._nextIndex === 0) return this.current;

    this._nextIndex--;
    this._current = this._nextIndex === 0 ? "" : this._stream[this._nextIndex - 1];
    return this.current;
  }

  public get current(): string {
    return this._current;
  }

  public get peek(): string {
    return this.isEOF ? "" : this._stream[this._nextIndex];
  }

  public get isEOF(): boolean {
    return this._nextIndex >= this._stream.length;
  }
}
