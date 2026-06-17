/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { usePreferencesContext } from "../PropertyGridPreferencesContext.js";
import { useTelemetryContext } from "./UseTelemetryContext.js";

import type { PropsWithChildren } from "react";

/**
 * Provides context for `Show\Hide Empty Values` setting.
 * @public
 */
export function EmptyValuesSettingContext({ children }: PropsWithChildren<object>) {
  const { showEmptyValues, setShowEmptyValues } = useEmptyValuesSetting();

  return <emptyValuesSettingContext.Provider value={{ showEmptyValues, setShowEmptyValues }}>{children}</emptyValuesSettingContext.Provider>;
}

/**
 * Provides context for `Show\Hide Empty Values` setting.
 * @deprecated in 1.20. Use `EmptyValuesSettingContext` instead.
 * @public
 */
export const NullValueSettingContext = EmptyValuesSettingContext;

/**
 * Custom hook for tracking of "show/hide empty values" setting in property grid.
 * @internal
 */
export function useEmptyValuesSetting() {
  const [showEmptyValues, setShowEmptyValues] = useState(true);
  const { getShowEmptyValuesPreference, setShowEmptyValuesPreference } = useEmptyValuesStorage();
  const { onFeatureUsed } = useTelemetryContext();

  // Get value from preferences storage
  useEffect(() => {
    void (async () => {
      const res = await getShowEmptyValuesPreference();
      onFeatureUsed(res ? "hide-empty-values-disabled" : "hide-empty-values-enabled");
      setShowEmptyValues(res);
    })();
  }, [getShowEmptyValuesPreference, onFeatureUsed]);

  // Function for updating Hide / Show Empty Fields setting
  const updateShowEmptyValues = useCallback(
    async (value: boolean, options?: { persist?: boolean }) => {
      onFeatureUsed(value ? "hide-empty-values-disabled" : "hide-empty-values-enabled");
      setShowEmptyValues(value);

      // Persist hide/show value
      if (options && options.persist) {
        await setShowEmptyValuesPreference(value);
      }
    },
    [setShowEmptyValuesPreference, onFeatureUsed],
  );

  return {
    showEmptyValues,
    setShowEmptyValues: updateShowEmptyValues,
  };
}

/** @internal */
export const SHOW_EMPTY_KEY = "showEmptyValues";

function useEmptyValuesStorage() {
  const { storage } = usePreferencesContext();

  const getShowEmptyValuesPreference = useCallback(async () => {
    const serializedValue = await storage.get(SHOW_EMPTY_KEY);
    if (serializedValue !== undefined) {
      return JSON.parse(serializedValue);
    }
    // default to `true`
    return true;
  }, [storage]);

  const setShowEmptyValuesPreference = useCallback(
    async (value: boolean) => {
      await storage.set(SHOW_EMPTY_KEY, JSON.stringify(value));
    },
    [storage],
  );

  return {
    getShowEmptyValuesPreference,
    setShowEmptyValuesPreference,
  };
}

/** @internal */
export interface EmptyValuesSettingContextValue {
  showEmptyValues: boolean;
  setShowEmptyValues: (value: boolean, options?: { persist?: boolean }) => Promise<void>;
}

/* c8 ignore next */
const emptyValuesSettingContext = createContext<EmptyValuesSettingContextValue>({ showEmptyValues: true, setShowEmptyValues: async () => {} });

/** @internal */
export function useEmptyValuesSettingContext() {
  return useContext(emptyValuesSettingContext);
}
