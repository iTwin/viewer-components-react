/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { createContext, useContext, useMemo } from "react";
import { LocalizationContextProvider } from "./shared/contexts/LocalizationContext.js";
import { LoggerContextProvider } from "./shared/contexts/LoggerContext.js";
import { SharedTreeContextProvider } from "./shared/contexts/SharedTreeContext.js";

import type { PropsWithChildren, ReactNode } from "react";
import type { Localization } from "@itwin/core-common";
import type { ILogger } from "@itwin/presentation-shared";

interface TreeWidgetContext {
  isInitialized: boolean;
}

const defaultContextValue: TreeWidgetContext = {
  isInitialized: false,
};

const treeWidgetContext = createContext<TreeWidgetContext>(defaultContextValue);

/**
 * Properties for `TreeWidgetContextProvider`.
 * @beta
 */
interface TreeWidgetContextProviderProps {
  /** Localization object for localizing tree widget components. */
  localization: Pick<Localization, "getLocalizedString">;
  /** Logger used by tree widget components. Defaults to `Logger` from `@itwin/core-bentley`. */
  logger?: ILogger;
}

/**
 * Provides localization, logging, and shared resources for tree widget components.
 *
 * Place a single provider near the root of the application, above all tree widget components.
 * Standard tree components create their own telemetry context. Custom trees composed from
 * `use*Tree` hooks should use `TelemetryContextProvider` when telemetry reporting is required.
 *
 * @beta
 */
export function TreeWidgetContextProvider({ children, localization, logger }: PropsWithChildren<TreeWidgetContextProviderProps>): ReactNode {
  const context = useContext(treeWidgetContext);

  if (context.isInitialized) {
    return children;
  }

  return (
    <TreeWidgetContextProviderImpl localization={localization} logger={logger}>
      {children}
    </TreeWidgetContextProviderImpl>
  );
}

function TreeWidgetContextProviderImpl({ children, localization, logger }: PropsWithChildren<TreeWidgetContextProviderProps>) {
  const contextValue = useMemo<TreeWidgetContext>(() => {
    return {
      isInitialized: true,
    };
  }, []);
  return (
    <treeWidgetContext.Provider value={contextValue}>
      <LocalizationContextProvider localization={localization}>
        <LoggerContextProvider logger={logger}>
          <SharedTreeContextProvider>{children}</SharedTreeContextProvider>
        </LoggerContextProvider>
      </LocalizationContextProvider>
    </treeWidgetContext.Provider>
  );
}
