/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { ConfigService } from "./ConfigService";

export class LoggerService {

  public static log(...msg: any[]): void {
    if (ConfigService.isLoggingEnabled()) {
      LoggerService.addMessagePrefix(msg);
      console.log.apply(console, msg); // eslint-disable-line no-console
    }
  }

  public static warn(...msg: any[]): void {
    LoggerService.addMessagePrefix(msg);
    console.warn.apply(console, msg); // eslint-disable-line no-console
  }

  public static error(...msg: any[]): void {
    LoggerService.addMessagePrefix(msg);
    console.error.apply(console, msg); // eslint-disable-line no-console
  }

  private static addMessagePrefix(msg: any[]): void {
    if (typeof msg[0] === "string") {
      msg[0] = `IoT | ${msg[0]}`;
    }
  }

}
