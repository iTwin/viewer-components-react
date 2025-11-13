/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import type { ILogger, LogLevel } from "@itwin/presentation-shared";

export const LOGGER: ILogger = {
  isEnabled: (_category: string, level: LogLevel) => {
    return level === "error" || level === "warning";
  },
  logError: (category: string, message: string) => console.log(createLogMessage("error", category, message)),
  logWarning: (category: string, message: string) => console.log(createLogMessage("warning", category, message)),
  logInfo: (category: string, message: string) => console.log(createLogMessage("info", category, message)),
  logTrace: (category: string, message: string) => console.log(createLogMessage("trace", category, message)),
};

function createLogMessage(severity: LogLevel, category: string, message: string) {
  const now = new Date();
  const timeStr = now.toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    fractionalSecondDigits: 3,
  });
  return `[${timeStr}] ${severity.toUpperCase().padEnd(7)} | ${category} | ${message}`;
}
