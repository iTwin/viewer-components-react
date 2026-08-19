/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { LocalizationContextProvider } from "./shared/contexts/LocalizationContext.js";
import { SharedTreeContextProvider } from "./shared/contexts/SharedTreeContext.js";
import { TelemetryContextProvider } from "./shared/contexts/UseTelemetryContext.js";

import type { PropsWithChildren } from "react";
import type { Localization } from "@itwin/core-common";
import type { ILogger } from "@itwin/presentation-shared";

/**
 * Properties for `TreeWidgetContextProvider`.
 * @beta
 */
export interface TreeWidgetContextProviderProps {
  /** Localization object for localizing tree widget components. */
  localization: Pick<Localization, "getLocalizedString">;
  /** Logger used by tree widget components. Defaults to `Logger` from `@itwin/core-bentley`. */
  logger?: ILogger;
  /** Callback that is invoked when performance of a tracked feature is measured. */
  onPerformanceMeasured?: (featureId: string, duration: number) => void;
  /** Callback that is invoked when a tracked feature is used. */
  onFeatureUsed?: (featureId: string) => void;
  /** Identifier prepended to telemetry feature IDs emitted directly by this context. Defaults to `tree-widget`. */
  componentIdentifier?: string;
}

/**
 * Context provider for tree widget components.
 * @beta
 */
export function TreeWidgetContextProvider({
  children,
  localization,
  logger,
  onPerformanceMeasured,
  onFeatureUsed,
  componentIdentifier,
}: PropsWithChildren<TreeWidgetContextProviderProps>) {
  return (
    <LocalizationContextProvider localization={localization}>
      <TelemetryContextProvider
        componentIdentifier={componentIdentifier ?? "tree-widget"}
        onPerformanceMeasured={onPerformanceMeasured}
        onFeatureUsed={onFeatureUsed}
        logger={logger}
      >
        <SharedTreeContextProvider>{children}</SharedTreeContextProvider>
      </TelemetryContextProvider>
    </LocalizationContextProvider>
  );
}
