/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

export class SocketError {

  private readonly code?: number;
  private readonly message?: string;
  private readonly data: any;

  constructor(code?: number, message?: string) {
    this.code = code;
    this.message = message;
  }

  public getCode(): number | undefined {
    return this.code;
  }

  public getMessage(): string | undefined {
    return this.message;
  }

  public getData(): any {
    return this.data;
  }

}
