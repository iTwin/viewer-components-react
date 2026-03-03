/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { createContext, useContext, useMemo } from "react";
import {
  LocalizationContextProvider as HierarchiesLocalizationContext,
  LOCALIZATION_NAMESPACES as HierarchiesReactLocalizationNamespaces,
} from "@itwin/presentation-hierarchies-react";
import { LOCALIZATION_NAMESPACE } from "../../../shared/LocalizedStrings.js";

import type { JSX, PropsWithChildren } from "react";
import type { Localization } from "@itwin/core-common";
import type { LocalizationKey } from "../../../shared/LocalizedStrings.js";

type TranslateFunc = (key: LocalizationKey) => string;

const localizationContext = createContext<TranslateFunc>((key) => key);

/**
 * Namespaces used for localization of presentation hierarchies components.
 * @alpha
 */
export const LOCALIZATION_NAMESPACES = [LOCALIZATION_NAMESPACE, ...HierarchiesReactLocalizationNamespaces];

/**
 * Properties for `LocalizationContextProvider`.
 * @public
 */
interface LocalizationContextProviderProps {
  /** Localization object compatible with `@itwin/core-common` */
  localization: Pick<Localization, "getLocalizedString">;
}

/**
 * Context provider for localizing components.
 * @public
 */
export function LocalizationContextProvider({ localization, children }: PropsWithChildren<LocalizationContextProviderProps>): JSX.Element {
  const translate = useMemo<TranslateFunc>(() => {
    return (key: LocalizationKey) => localization.getLocalizedString(`${LOCALIZATION_NAMESPACE}:${key}`);
  }, [localization]);
  return (
    <localizationContext.Provider value={translate}>
      <HierarchiesLocalizationContext localization={localization}>{children}</HierarchiesLocalizationContext>
    </localizationContext.Provider>
  );
}

/** @internal */
export function useTranslation() {
  return useContext(localizationContext);
}
