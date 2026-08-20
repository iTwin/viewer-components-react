/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { createContext, useContext, useEffect, useMemo } from "react";
import { Logger } from "@itwin/core-bentley";
import { createLogger } from "@itwin/presentation-core-interop";
import { setLogger as setHierarchiesLogger } from "@itwin/presentation-hierarchies";
import { setLogger as setHierarchiesReactLogger } from "@itwin/presentation-hierarchies-react";
import { LOGGING_NAMESPACE } from "../Utils.js";

import type { PropsWithChildren } from "react";
import type { ILogger } from "@itwin/presentation-shared";

const defaultLogger = createLogger(Logger);

interface LoggerContext {
  logger: ILogger;
}

const defaultContextValue: LoggerContext = {
  logger: defaultLogger,
};

const loggerContext = createContext<LoggerContext>(defaultContextValue);

/** @internal */
export interface LoggerContextProviderProps {
  logger?: ILogger;
}

/** @internal */
export function LoggerContextProvider({ children, logger }: PropsWithChildren<LoggerContextProviderProps>) {
  const contextValue = useMemo<LoggerContext>(() => {
    const activeLogger = logger ?? defaultLogger;
    return {
      logger: {
        isEnabled: (category, severity) => activeLogger.isEnabled(`${LOGGING_NAMESPACE}.${category}`, severity),
        logError: (category, message) => {
          activeLogger.logError(`${LOGGING_NAMESPACE}.${category}`, message);
        },
        logInfo: (category, message) => {
          activeLogger.logInfo(`${LOGGING_NAMESPACE}.${category}`, message);
        },
        logTrace: (category, message) => {
          activeLogger.logTrace(`${LOGGING_NAMESPACE}.${category}`, message);
        },
        logWarning: (category, message) => {
          activeLogger.logWarning(`${LOGGING_NAMESPACE}.${category}`, message);
        },
      },
    };
  }, [logger]);

  useEffect(() => {
    setHierarchiesLogger(contextValue.logger);
    setHierarchiesReactLogger(contextValue.logger);
    return () => {
      setHierarchiesLogger(undefined);
      setHierarchiesReactLogger(undefined);
    };
  }, [contextValue.logger]);

  return <loggerContext.Provider value={contextValue}>{children}</loggerContext.Provider>;
}

/** @internal */
export function useLogger() {
  return useContext(loggerContext);
}
