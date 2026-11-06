/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
import * as React from "react";
import { IModelApp } from "@itwin/core-frontend";

import type { UnitsProvider } from "@itwin/core-quantity";

function subscribeToUnitsProvider(onStoreChange: () => void) {
  return IModelApp.quantityFormatter.onUnitsProviderChanged.addListener(onStoreChange);
}

function skipSubscription() {
  return () => undefined;
}

/**
 * Returns `unitsProvider` when given; otherwise `IModelApp.quantityFormatter.unitsProvider` (the bundled BIS units unless the
 * app replaced it), re-rendering when the app replaces it.
 * @internal
 */
export function useUnitsProvider(unitsProvider?: UnitsProvider): UnitsProvider {
  return React.useSyncExternalStore(
    unitsProvider ? skipSubscription : subscribeToUnitsProvider,
    () => unitsProvider ?? IModelApp.quantityFormatter.unitsProvider
  );
}
