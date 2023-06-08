/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { useCallback, useEffect, useState } from "react";
import { usePreferencesContext } from "../PropertyGridPreferencesContext";

/**
 * Definition of `null` values setting state.
 * @public
 */
export interface NullValueSetting {
  /** Specifies whether `null` values are shown. */
  showNullValues: boolean;
  /** Callback for changing `showNullValues` values. */
  setShowNullValues: (value: boolean, options?: { persist?: boolean }) => Promise<void>;
}

/**
 * Custom hook for tracking of "show/hide null values" setting in property grid.
 * @internal
 */
export function useNullValueSetting(): NullValueSetting {
  const [showNullValues, setShowNullValues] = useState(true);
  const { getShowNullValuesPreference, setShowNullValuesPreference } = useNullValueStorage();

  // Get value from preferences storage
  useEffect(() => {
    void (async () => {
      const res = await getShowNullValuesPreference();
      setShowNullValues(res);
    })();
  }, [getShowNullValuesPreference]);

  // Function for updating Hide / Show Empty Fields setting
  const updateShowNullValues = useCallback(async (value: boolean, options?: { persist?: boolean }) => {
    setShowNullValues(value);

    // Persist hide/show value
    if (options?.persist) {
      await setShowNullValuesPreference(value);
    }
  }, [setShowNullValuesPreference]);

  return {
    showNullValues,
    setShowNullValues: updateShowNullValues,
  };
}

const SHOWNULL_KEY = "showNullValues";

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

  const setShowNullValuesPreference = useCallback(async (value: boolean) => {
    await storage.set(SHOWNULL_KEY, JSON.stringify(value));
  }, [storage]);

  return {
    getShowNullValuesPreference,
    setShowNullValuesPreference,
  };
}
