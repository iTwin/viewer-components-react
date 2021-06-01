/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { Logger, LogLevel } from "@bentley/bentleyjs-core";

/** Enumerates log categories used by the **measure-tools** package. */
export enum MeasureToolsLoggerCategory {
  /** Root category used by the **measure-tools** package. */
  Root = "Measure-Tools",
}

export namespace MeasureToolsLoggerCategory {
  /** Gets all the categories used in the packages as an array. */
  export function getCategories(): string[] { return [MeasureToolsLoggerCategory.Root]; }

  /** Sets all the categories used in the packages to the specified log level. */
  export function setLogLevel(minLevel: LogLevel) {
    for (const cat of MeasureToolsLoggerCategory.getCategories())
      Logger.setLevel(cat, minLevel);
  }
}
