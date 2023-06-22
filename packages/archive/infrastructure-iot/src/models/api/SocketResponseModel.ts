/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { plainToInstance } from "class-transformer";
import { isArray as _isArray } from "lodash";

import { SocketResponseStatus } from "../../enums/api/SocketResponseStatusEnum";
import { SocketError } from "./SocketErrorModel";

export class SocketResponse {

  private readonly result: any;
  private readonly error: SocketError;

  constructor(response: any) {
    this.result = response.result || undefined;
    this.error = plainToInstance(SocketError, response.error as object) || undefined;
  }

  public isFinished(): boolean {
    return this.isError() || (this.result && this.result.requestStatus === SocketResponseStatus.FINISHED);
  }

  public isError(): boolean {
    return !!this.error;
  }

  public hasData(): boolean {
    if (!this.isError() && this.result) {
      if (!_isArray(this.result)) {
        const keys = Object.keys(this.result);
        return keys.length > 1 || keys[0] !== "requestStatus";
      } else {
        return true;
      }
    } else {
      return false;
    }
  }

  public getData(): any {
    if (!this.isError()) {
      return this.result;
    } else {
      return undefined;
    }
  }

  public getError(): SocketError | undefined {
    if (this.isError()) {
      return this.error;
    } else {
      return undefined;
    }
  }

}
