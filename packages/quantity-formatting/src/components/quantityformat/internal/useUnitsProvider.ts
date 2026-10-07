/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
import * as React from "react";
import { IModelApp } from "@itwin/core-frontend";

import type { UnitsProvider } from "@itwin/core-quantity";

/**
 * Returns `unitsProvider` when given; otherwise `IModelApp.quantityFormatter.unitsProvider` (the bundled BIS units unless the
 * app replaced it), re-rendering when the app replaces it.
 * @internal
 */
export function useUnitsProvider(unitsProvider?: UnitsProvider): UnitsProvider {
  const [defaultProvider, setDefaultProvider] = React.useState<UnitsProvider | undefined>(() => (unitsProvider ? undefined : IModelApp.quantityFormatter.unitsProvider));

  React.useEffect(() => {
    if (unitsProvider) return;
    const update = () => setDefaultProvider(IModelApp.quantityFormatter.unitsProvider);
    update(); // The provider may have changed between the first render and subscribing.
    return IModelApp.quantityFormatter.onUnitsProviderChanged.addListener(update);
  }, [unitsProvider]);

  return unitsProvider ?? defaultProvider ?? IModelApp.quantityFormatter.unitsProvider;
}
