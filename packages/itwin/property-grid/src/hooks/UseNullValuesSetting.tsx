/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { usePreferencesContext } from "../PropertyGridPreferencesContext";
import { useTelemetryContext } from "./UseTelemetryContext";

import type { PropsWithChildren } from "react";

/**
 * Provides context for `Show\Hide Empty Values` setting.
 * @public
 */
export function NullValueSettingContext({ children }: PropsWithChildren<{}>) {
  const { showNullValues, setShowNullValues } = useNullValueSetting();

  return <nullValueSettingContext.Provider value={{ showNullValues, setShowNullValues }}>{children}</nullValueSettingContext.Provider>;
}

/**
 * Custom hook for tracking of "show/hide null values" setting in property grid.
 * @internal
 */
export function useNullValueSetting() {
  const [showNullValues, setShowNullValues] = useState(true);
  const { getShowNullValuesPreference, setShowNullValuesPreference } = useNullValueStorage();
  const { onFeatureUsed } = useTelemetryContext();

  // Get value from preferences storage
  useEffect(() => {
    void (async () => {
      const res = await getShowNullValuesPreference();
      onFeatureUsed(res ? "hide-empty-values-disabled" : "hide-empty-values-enabled");
      setShowNullValues(res);
    })();
  }, [getShowNullValuesPreference, onFeatureUsed]);

  // Function for updating Hide / Show Empty Fields setting
  const updateShowNullValues = useCallback(
    async (value: boolean, options?: { persist?: boolean }) => {
      onFeatureUsed(value ? "hide-empty-values-disabled" : "hide-empty-values-enabled");
      setShowNullValues(value);

      // Persist hide/show value
      if (options && options.persist) {
        await setShowNullValuesPreference(value);
      }
    },
    [setShowNullValuesPreference, onFeatureUsed],
  );

  return {
    showNullValues,
    setShowNullValues: updateShowNullValues,
  };
}

/** @internal */
export const SHOWNULL_KEY = "showNullValues";

function useNullValueStorage() {
  const { storage } = usePreferencesContext();

  const getShowNullValuesPreference = useCallback(async () => {
    const serializedValue = await storage.get(SHOWNULL_KEY);
    if (serializedValue !== undefined) {
      return JSON.parse(serializedValue);
    }
    // default to `true`
    return true;
  }, [storage]);

  const setShowNullValuesPreference = useCallback(
    async (value: boolean) => {
      await storage.set(SHOWNULL_KEY, JSON.stringify(value));
    },
    [storage],
  );

  return {
    getShowNullValuesPreference,
    setShowNullValuesPreference,
  };
}

/** @internal */
export interface NullValueSettingContextValue {
  showNullValues: boolean;
  setShowNullValues: (value: boolean, options?: { persist?: boolean }) => Promise<void>;
}

// istanbul ignore next
const nullValueSettingContext = createContext<NullValueSettingContextValue>({ showNullValues: true, setShowNullValues: async () => {} });

/** @internal */
export function useNullValueSettingContext() {
  return useContext(nullValueSettingContext);
}
